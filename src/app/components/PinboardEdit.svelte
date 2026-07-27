<script lang="ts">
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
  import {goto} from "$app/navigation"
  import RelayName from "@app/components/RelayName.svelte"
  import {editBoard, type Board} from "@app/pinboards"
  import {makeLibraryPath} from "@app/routes"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    board: Board
    isNew?: boolean
  }

  const {url, board, isNew = false}: Props = $props()

  let title = $state(board.title)
  let description = $state(board.description)
  let loading = $state(false)

  const back = () => history.back()

  const submit = async () => {
    loading = true

    try {
      const error = await editBoard(url, {...board, title, description})

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: isNew ? "Shelf created!" : "Shelf updated!"})

        // Navigate to a freshly created board; otherwise just close the modal.
        if (isNew) {
          goto(makeLibraryPath(url, board.address))
        } else {
          back()
        }
      }
    } finally {
      loading = false
    }
  }
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>{isNew ? "Create Shelf" : "Edit Shelf"}</ModalTitle>
      <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        Title
      {/snippet}
      {#snippet input()}
        <input bind:value={title} class="input w-full" placeholder="Shelf title" />
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        Description
      {/snippet}
      {#snippet input()}
        <input
          bind:value={description}
          class="input w-full"
          placeholder="What's this shelf about?" />
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" onclick={submit} disabled={loading || !title.trim()}>
      <Spinner {loading}>Save changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
