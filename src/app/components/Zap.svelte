<script lang="ts">
  import {first, uniq} from "@welshman/lib"
  import {inbox} from "@welshman/util"
  import {ZapRequest} from "@welshman/domain"
  import {Zappers} from "@welshman/app"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
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
  import ZapForm from "@app/components/ZapForm.svelte"
  import {payInvoice} from "@app/lightning"
  import {zapAmounts} from "@app/settings"
  import {pushToast} from "@app/toast"
  import {app, domain, network, router} from "@app/core"

  type Props = {
    url?: string
    pubkey: string
    eventId?: string
    // NIP-75 requires a zap to a goal to request its receipt on the goal's own relays.
    goalRelays?: string[]
  }

  const {url, pubkey, eventId, goalRelays = []}: Props = $props()

  const zapper = $app.use(Zappers).forPubkey(pubkey)

  const back = () => history.back()

  const sendZap = async () => {
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
          message: `Failed to zap: ${res.error || "no error given"}`,
        })
      }

      await payInvoice(res.invoice)
      await $network.load({
        relays,
        filters: [currentZapper.getResponseFilter(pubkey, eventId)],
      })

      pushToast({message: "Zap successfully sent!"})
      back()
    } catch (e) {
      console.error(e)

      const message = errorMessage(e)

      pushToast({
        theme: "error",
        message: `Failed to zap: ${message}`,
      })
    } finally {
      loading = false
    }
  }

  let amount = $state<number>(first($zapAmounts) ?? 21)
  let content = $state("⚡️")
  let loading = $state(false)
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Send a Zap</ModalTitle>
      <ModalSubtitle>To <ProfileLink {pubkey} class="text-primary!" /></ModalSubtitle>
    </ModalHeader>
    <ZapForm bind:amount bind:content />
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" onclick={sendZap} disabled={loading}>
      <Spinner {loading}>
        <div class="flex items-center gap-2">
          {#if !loading}
            <Icon icon={Bolt} />
          {/if}
          Send Zap
        </div>
      </Spinner>
    </Button>
  </ModalFooter>
</Modal>
