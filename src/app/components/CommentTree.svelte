<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import CommentCompose from "@app/components/CommentCompose.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import CommentActions from "@app/components/CommentActions.svelte"
  import type {FeedContext} from "@app/feeds"
  import type {CommentNode} from "@app/social"

  type Props = {
    node: CommentNode
    root: TrustedEvent
    replyTo?: TrustedEvent
    setReplyTo: (comment?: TrustedEvent) => void
    url?: string
    context: FeedContext
  }

  const {node, root, replyTo, setReplyTo, url, context}: Props = $props()

  const composing = $derived(replyTo?.id === node.comment.id)

  const reply = () => setReplyTo(node.comment)

  const clearReplyTo = () => setReplyTo(undefined)
</script>

<div class="flex flex-col gap-3">
  <NoteCard event={node.comment} {url} class="card z-feature w-full">
    <div class="flex flex-col gap-3 ml-12">
      <NoteContent showEntire event={node.comment} {url} />
      {#if url}
        <div class="flex flex-wrap items-center justify-between gap-2">
          <Button class="button button-neutral button-sm" onclick={reply}>
            <Icon icon={Reply} />
            Reply
          </Button>
          <CommentActions event={node.comment} {url} {context} />
        </div>
      {/if}
    </div>
  </NoteCard>
  {#if composing && url}
    <div class="ml-4 pl-4">
      <CommentCompose
        {url}
        event={root}
        parent={node.comment}
        onCancel={clearReplyTo}
        onSubmit={clearReplyTo} />
    </div>
  {/if}
  {#if node.children.length > 0}
    <div class="flex flex-col gap-3 border-l border-solid border-line ml-4 pl-4">
      {#each node.children as child (child.comment.id)}
        <CommentTree node={child} {root} {replyTo} {setReplyTo} {url} {context} />
      {/each}
    </div>
  {/if}
</div>
