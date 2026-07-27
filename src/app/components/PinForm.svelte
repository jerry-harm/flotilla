<script module lang="ts">
  export type PinFormValues = {
    title: string
    topics: string[]
    value: string
    content: string
  }
</script>

<script lang="ts">
  import {writable} from "svelte/store"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
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
  import StringMultiInput from "@lib/components/StringMultiInput.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {makeEditor} from "@app/editor"
  import {pushToast} from "@app/toast"
  import {clearModals} from "@app/modal"

  type Props = {
    url: string
    heading: string
    action: string
    successMessage: string
    values?: Partial<PinFormValues>
    submit: (values: PinFormValues) => Promise<string | undefined>
  }

  const {url, heading, action, successMessage, values = {}, submit}: Props = $props()

  let title = $state(values.title ?? "")
  let topics = $state<string[]>(values.topics ?? [])
  let value = $state(values.value ?? "")
  let content = $state<string | object>(values.content ?? "")
  let loading = $state(false)

  const uploading = writable(false)

  const back = () => history.back()

  const onSubmit = async () => {
    loading = true

    try {
      const ed = await editor
      const description = ed.getText({blockSeparator: "\n"}).trim()
      const error = await submit({title, topics, value, content: description})

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: successMessage})
        clearModals()
      }
    } finally {
      loading = false
    }
  }

  const onChange = (json: object) => {
    content = json
  }

  const editor = makeEditor({url, submit: onSubmit, uploading, onChange, content})

  const selectFiles = () => editor.then(ed => ed.chain().selectFiles().run())
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>{heading}</ModalTitle>
      <ModalSubtitle>on <RelayName {url} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        Title
      {/snippet}
      {#snippet input()}
        <input
          bind:value={title}
          class="input input-bordered w-full"
          placeholder="Optional title" />
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        Description
      {/snippet}
      {#snippet input()}
        <div class="relative z-feature flex gap-2">
          <div class="input-editor grow overflow-hidden">
            <EditorContent {editor} />
          </div>
          <Button
            data-tip="Add an image"
            class="button button-neutral button-input tip"
            onclick={selectFiles}
            disabled={loading}>
            {#if $uploading}
              <Spinner size="xs" />
            {:else}
              <Icon icon={GallerySend} />
            {/if}
          </Button>
        </div>
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        Topics
      {/snippet}
      {#snippet input()}
        <StringMultiInput bind:value={topics} placeholder="Add a topic..." />
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        Link
      {/snippet}
      {#snippet info()}
        <p>A URL or nostr link (note, nevent, naddr, npub, or nprofile).</p>
      {/snippet}
      {#snippet input()}
        <input bind:value class="input input-bordered w-full" placeholder="URL or nevent..." />
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
      onclick={onSubmit}
      disabled={loading || $uploading || !value.trim()}>
      <Spinner {loading}>{action}</Spinner>
    </Button>
  </ModalFooter>
</Modal>
