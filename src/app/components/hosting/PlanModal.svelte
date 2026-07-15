<script lang="ts">
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import PricingTable from "@app/components/hosting/PricingTable.svelte"
  import PaymentDialog from "@app/components/hosting/PaymentDialog.svelte"
  import PaymentSetup from "@app/components/hosting/PaymentSetup.svelte"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"
  import {pubkey} from "@welshman/app"
  import {
    autopayConfigured,
    derivePlans,
    getTenant,
    HostingError,
    listTenantInvoices,
    reconcileTenant,
    selectPayableInvoice,
    updateRelay,
    type Relay,
  } from "@app/hosting"

  type Props = {
    relay: Relay
    onUpdate?: (relay: Relay) => void
  }

  const {relay, onUpdate}: Props = $props()

  const plans = derivePlans()

  let selected = $state(relay.plan_id)
  let saving = $state(false)

  const canSave = $derived(!saving && selected !== relay.plan_id)

  const back = () => history.back()

  const selectPlan = (id: string) => {
    selected = id
  }

  const save = async () => {
    if (!canSave) return

    saving = true

    try {
      // Downgrading to free turns off the features that plan doesn't include.
      const updated = await updateRelay(
        relay.id,
        selected === "free"
          ? {plan_id: selected, blossom_enabled: 0, livekit_enabled: 0}
          : {plan_id: selected},
      )

      onUpdate?.(updated)
      pushToast({message: "Plan updated."})

      if (selected === "free") {
        back()
        return
      }

      await reconcileTenant($pubkey!)

      const tenant = await getTenant($pubkey!)

      if (autopayConfigured(tenant)) {
        back()
      } else {
        const invoice = selectPayableInvoice(await listTenantInvoices($pubkey!))

        if (invoice) {
          pushModal(PaymentDialog, {invoice}, {replaceState: true})
        } else {
          pushModal(PaymentSetup, {}, {replaceState: true})
        }
      }
    } catch (e) {
      pushToast({
        theme: "error",
        message: e instanceof HostingError ? e.message : "Failed to update plan.",
      })
    } finally {
      saving = false
    }
  }
</script>

<Modal tag="form" onsubmit={preventDefault(save)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Change plan</ModalTitle>
      <ModalSubtitle>Pick a plan for this space.</ModalSubtitle>
    </ModalHeader>
    <PricingTable plans={$plans} selectable value={selected} onSelect={selectPlan} />
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={saving}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={!canSave}>
      <Spinner loading={saving}>Save</Spinner>
    </Button>
  </ModalFooter>
</Modal>
