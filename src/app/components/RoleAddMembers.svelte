<script lang="ts">
  import type {RelayRoleReader} from "@welshman/domain"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileMultiSelect from "@app/components/ProfileMultiSelect.svelte"
  import {relayManagement, relayMemberLists} from "@app/core"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    role: RelayRoleReader
  }

  const {url, role}: Props = $props()

  const back = () => history.back()

  let loading = $state(false)
  let pubkeys: string[] = $state([])

  const submit = async () => {
    loading = true

    try {
      const members = $relayMemberLists.get(url)
      const management = $relayManagement.forUrl(url)

      for (const pubkey of pubkeys) {
        // Ensure they're space members first, then assign the role
        if (!members?.isMember(pubkey)) {
          const {error} = await management.allowPubkey(pubkey)

          if (error) {
            pushToast({theme: "error", message: error})
            return
          }
        }

        const {error} = await management.assignRole(pubkey, role.identifier()!)

        if (error) {
          pushToast({theme: "error", message: error})
          return
        }
      }

      pushToast({message: "Members assigned!"})
      back()
    } finally {
      loading = false
    }
  }
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Add to {role.label() || "Role"}</ModalTitle>
      <ModalSubtitle>Assign members to this role</ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        <p>Search for People</p>
      {/snippet}
      {#snippet input()}
        <ProfileMultiSelect bind:value={pubkeys} />
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button
      class="button button-primary"
      onclick={submit}
      disabled={loading || pubkeys.length === 0}>
      <Spinner {loading}>Save changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
