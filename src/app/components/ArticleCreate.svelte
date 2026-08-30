<script lang="ts">
  import {writable} from "svelte/store"
  import {now, randomId} from "@welshman/lib"
  import {Article} from "@welshman/domain"
  import {publishToRelays} from "@welshman/app"
  import {isMobile, preventDefault} from "@lib/html"
  import Paperclip from "@assets/icons/paperclip-2.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import TopicMultiSelect from "@app/components/TopicMultiSelect.svelte"
  import EditorContent from "@app/editor/EditorContent.svelte"
  import {command, relays, writer} from "@app/core"
  import {DraftKey} from "@app/drafts"
  import {makeEditor} from "@app/editor"
  import {publishRoomQuote} from "@app/rooms"
  import {pushToast} from "@app/toast"

  type Values = {
    d?: string
    content?: string | object
    title?: string
    summary?: string
    topics?: string[]
  }

  type Props = {
    url: string
    h?: string
    shareToChat?: boolean
  }

  const {url, h, shareToChat = false}: Props = $props()
  const draftKey = new DraftKey<Values>(`article:${url}:${h ?? ""}`)
  const initialValues = draftKey.get()
  const shouldProtect = $relays.hasNip(url, 70)

  const uploading = writable(false)

  const back = () => history.back()

  const selectFiles = () => editor.then(ed => ed.commands.selectFiles())

  const submit = async () => {
    if ($uploading || loading) return

    if (!title) {
      return pushToast({
        theme: "error",
        message: "Please provide a title for your article.",
      })
    }

    const ed = await editor
    const content = ed.getText({blockSeparator: "\n"}).trim()

    if (!content) {
      return pushToast({
        theme: "error",
        message: "Please write something for your article.",
      })
    }

    loading = true

    try {
      const protect = await shouldProtect
      const eventWriter = writer(Article)
        .setIdentifier(d)
        .setContent(content)
        .setTitle(title)
        .setTopics(topics)
        .setPublishedAt(now())
        .setProtected(protect)
        .addTags(...ed.storage.nostr.getEditorTags())
        .forceRelays(url)

      if (summary) {
        eventWriter.setSummary(summary)
      }

      if (h) {
        eventWriter.setRoom(url, h)
      }

      const thunk = await command(eventWriter).then(publishToRelays([url]))
      const error = await thunk.waitForError()

      if (error) {
        return pushToast({theme: "error", message: error})
      }

      draftKey.clear()
      history.back()

      if (shareToChat) {
        publishRoomQuote({url, h, parent: thunk.event, protect})
      }
    } finally {
      loading = false
    }
  }

  let loading = $state(false)

  const d = $state(initialValues?.d ?? randomId())
  let title = $state(initialValues?.title ?? "")
  let summary = $state(initialValues?.summary ?? "")
  let topics = $state(initialValues?.topics ?? [])
  let content = $state(initialValues?.content ?? "")

  const onChange = (json: object) => {
    content = json
  }

  const editor = makeEditor({
    url,
    submit,
    uploading,
    onChange,
    placeholder: "Write your article...",
    content,
  })

  $effect(() => {
    draftKey.update({d, title, summary, topics, content})
  })
</script>

<Modal tag="form" onsubmit={preventDefault(submit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Write an Article</ModalTitle>
      <ModalSubtitle>Publish a long-form post to this space.</ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-8 relative">
      <Field>
        {#snippet label()}
          <p>Title*</p>
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
            <!-- svelte-ignore a11y_autofocus -->
            <input
              autofocus={!isMobile}
              bind:value={title}
              class="grow"
              type="text"
              placeholder="What is this article about?" />
          </label>
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Summary</p>
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
            <input
              bind:value={summary}
              class="grow"
              type="text"
              placeholder="A one line teaser for the article list" />
          </label>
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Topics</p>
        {/snippet}
        {#snippet input()}
          <TopicMultiSelect bind:value={topics} />
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Content*</p>
        {/snippet}
        {#snippet input()}
          <div class="note-editor grow overflow-hidden">
            <EditorContent {editor} />
          </div>
        {/snippet}
      </Field>
      <Button
        data-tip="Add an image"
        class="tip tip-left absolute bottom-1 right-2"
        onclick={selectFiles}
        disabled={loading}>
        {#if $uploading}
          <Spinner size="xs" />
        {:else}
          <Icon icon={Paperclip} size={3} />
        {/if}
      </Button>
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={$uploading || loading}>
      <Spinner {loading}>Publish Article</Spinner>
    </Button>
  </ModalFooter>
</Modal>
