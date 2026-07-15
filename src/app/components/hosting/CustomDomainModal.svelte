<script lang="ts">
  import {preventDefault} from "@lib/html"
  import Global from "@assets/icons/global.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import VerifiedCheck from "@assets/icons/verified-check.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import Button from "@lib/components/Button.svelte"
  import Input from "@lib/components/Input.svelte"
  import Field from "@lib/components/Field.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {pushToast} from "@app/toast"
  import {canonicalRelayHost, flagToBool, updateRelay, HostingError, type Relay} from "@app/hosting"

  type Props = {
    relay: Relay
    onUpdate?: (relay: Relay) => void
  }

  const {relay, onUpdate}: Props = $props()

  const back = () => history.back()

  const clearDomain = () => {
    domain = ""
  }

  const submit = async (value: string) => {
    if (!loading) {
      loading = true

      try {
        const updated = await updateRelay(current.id, {custom_domain: value})

        current = updated
        domain = updated.custom_domain ?? ""
        onUpdate?.(updated)
        pushToast({message: value ? "Custom domain saved." : "Custom domain removed."})
        back()
      } catch (e) {
        const isHostingError = e instanceof HostingError

        pushToast({theme: "error", message: isHostingError ? e.message : "Failed to save domain."})

        if (!isHostingError) {
          console.error(e)
        }
      } finally {
        loading = false
      }
    }
  }

  const onSubmit = () => submit(domain.trim())

  // Local copy so the verified state updates in place after save/verify.
  let current = $state(relay)
  let domain = $state(relay.custom_domain ?? "")
  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Custom domain</ModalTitle>
      <ModalSubtitle>
        Point a domain you control at this relay instead of the default
        <span class="text-primary">{canonicalRelayHost(current)}</span> address.
      </ModalSubtitle>
    </ModalHeader>

    <Field>
      {#snippet label()}
        <Icon icon={Global} size={4} />
        <p>Domain</p>
      {/snippet}
      {#snippet secondary()}
        {#if current.custom_domain && flagToBool(current.custom_domain_verified, false)}
          <Badge variant="primary">
            <Icon icon={VerifiedCheck} size={3} />
            Verified
          </Badge>
        {/if}
      {/snippet}
      {#snippet input()}
        <Input
          bind:value={domain}
          type="text"
          placeholder="relay.example.com"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false">
          {#snippet after()}
            {#if domain}
              <Button
                onclick={clearDomain}
                aria-label="Clear domain"
                class="shrink-0 text-content-subtle hover:text-content">
                <Icon icon={CloseCircle} size={4} />
              </Button>
            {/if}
          {/snippet}
        </Input>
      {/snippet}
      {#snippet info()}
        <p>Must be a domain you control, e.g. relay.example.com.</p>
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>Save</Spinner>
    </Button>
  </ModalFooter>
</Modal>
