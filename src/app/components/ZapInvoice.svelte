<script lang="ts">
  import {onDestroy} from "svelte"
  import {first, removeUndefined, uniq} from "@welshman/lib"
  import {inbox} from "@welshman/util"
  import {ZapRequest} from "@welshman/domain"
  import {Zappers} from "@welshman/app"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {errorMessage} from "@lib/util"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import QRCode from "@app/components/QRCode.svelte"
  import WalletConnect from "@app/components/WalletConnect.svelte"
  import ZapForm from "@app/components/ZapForm.svelte"
  import {app, domain, network, router} from "@app/core"
  import {pushModal} from "@app/modal"
  import {zapAmounts} from "@app/settings"
  import {clip, pushToast} from "@app/toast"

  type Props = {
    url?: string
    pubkey: string
    eventId?: string
    // NIP-75 requires a zap to a goal to request its receipt on the goal's own relays.
    goalRelays?: string[]
  }

  const {url, pubkey, eventId, goalRelays = []}: Props = $props()

  const zapper = $app.use(Zappers).forPubkey(pubkey, removeUndefined([url]))

  const back = () => history.back()

  const createInvoice = async () => {
    loading = true

    try {
      const currentZapper = zapper.get()!
      const relays = uniq([
        ...(url ? [url] : await $router.resolver.relays([inbox(pubkey)])),
        ...goalRelays,
      ])
      const writer = $domain
        .writer(ZapRequest)
        .setContent(content)
        .setAmount(amount * 1000)
        .setLnurl(currentZapper.lnurl)
        .setRecipient(pubkey)
        .setUrls(relays)

      if (eventId) {
        writer.setEventId(eventId)
      }

      const res = await writer.requestInvoice(currentZapper)

      if (!res.invoice) {
        return pushToast({
          theme: "error",
          message: `Failed to create zap invoice: ${res.error || "no error given"}`,
        })
      }

      invoice = res.invoice

      paymentController?.abort()
      paymentController = new AbortController()

      $network.request({
        relays,
        signal: paymentController.signal,
        filters: [currentZapper.getResponseFilter(pubkey, eventId)],
        onEvent: () => {
          pushToast({message: "Payment sent!"})
          paymentController?.abort()
          back()
        },
      })
    } catch (e) {
      console.error(e)

      const message = errorMessage(e)

      pushToast({
        theme: "error",
        message: `Failed to create zap invoice: ${message}`,
      })
    } finally {
      loading = false
    }
  }

  const connectWallet = () => {
    pushModal(WalletConnect)
  }

  const copyInvoice = () => {
    if (invoice) {
      clip(invoice)
    }
  }

  let amount = $state<number>(first($zapAmounts) ?? 21)
  let content = $state("⚡️")
  let loading = $state(false)
  let invoice = $state<string>()
  let paymentController: AbortController | undefined = $state()

  onDestroy(() => {
    paymentController?.abort()
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Send a Zap</ModalTitle>
      <ModalSubtitle>To <ProfileLink {pubkey} class="text-primary!" /></ModalSubtitle>
    </ModalHeader>

    {#if invoice}
      <div class="flex flex-col gap-6">
        <div class="flex flex-col items-center gap-4">
          <QRCode code={invoice} class="w-full max-w-56" />
          <p class="text-content-muted text-center text-sm">
            Scan with your lightning wallet, or copy the invoice below.
          </p>
        </div>
        <label class="input flex w-full items-center gap-2">
          <input readonly class="min-w-0 grow truncate" value={invoice} />
          <Button
            class="button button-neutral button-sm button-square shrink-0"
            onclick={copyInvoice}>
            <Icon icon={Copy} size={4} />
          </Button>
        </label>
      </div>
    {:else}
      <ZapForm bind:amount bind:content>
        <div class="card card-sm card-flat flex flex-col items-center gap-3 p-4 text-center">
          <p class="text-content-muted text-sm">
            Connect a wallet to pay instantly without scanning a QR code.
          </p>
          <Button class="button button-neutral" onclick={connectWallet}>
            Connect a lightning wallet
          </Button>
        </div>
      </ZapForm>
    {/if}
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    {#if !invoice}
      <Button class="button button-primary" onclick={createInvoice} disabled={loading}>
        <Spinner {loading}>
          <div class="flex items-center gap-2">
            {#if !loading}
              <Icon icon={Bolt} />
            {/if}
            Create invoice
          </div>
        </Spinner>
      </Button>
    {/if}
  </ModalFooter>
</Modal>
