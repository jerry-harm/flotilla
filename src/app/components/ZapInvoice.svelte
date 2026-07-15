<script lang="ts">
  import {onDestroy} from "svelte"
  import {first} from "@welshman/lib"
  import {signer, deriveZapperForPubkey} from "@welshman/app"
  import {request} from "@welshman/net"
  import {Router} from "@welshman/router"
  import {requestZap, makeZapRequest, getZapResponseFilter} from "@welshman/util"
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
  import {pushModal} from "@app/modal"
  import {zapAmounts} from "@app/settings"
  import {clip, pushToast} from "@app/toast"

  type Props = {
    url?: string
    pubkey: string
    eventId?: string
  }

  const {url, pubkey, eventId}: Props = $props()

  const zapperStore = deriveZapperForPubkey(pubkey)

  const back = () => history.back()

  const createInvoice = async () => {
    loading = true

    try {
      const zapper = $zapperStore!
      const msats = amount * 1000
      const relays = url ? [url] : Router.get().ForPubkey(pubkey).getUrls()
      const params = {pubkey, content, eventId, msats, relays, zapper}
      const event = await $signer!.sign(makeZapRequest(params))
      const res = await requestZap({zapper, event})

      if (!res.invoice) {
        return pushToast({
          theme: "error",
          message: `Failed to create zap invoice: ${res.error || "no error given"}`,
        })
      }

      invoice = res.invoice

      paymentController?.abort()
      paymentController = new AbortController()

      request({
        relays,
        signal: paymentController.signal,
        filters: [getZapResponseFilter({zapper, pubkey, eventId})],
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
        {#snippet children()}
          <div class="card card-sm card-flat flex flex-col items-center gap-3 p-4 text-center">
            <p class="text-content-muted text-sm">
              Connect a wallet to pay instantly without scanning a QR code.
            </p>
            <Button class="button button-neutral" onclick={connectWallet}>
              Connect a lightning wallet
            </Button>
          </div>
        {/snippet}
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
