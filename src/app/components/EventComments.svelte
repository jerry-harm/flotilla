<script lang="ts">
  import {onMount} from "svelte"
  import {removeUndefined} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getCommentFiltersForRoot} from "@welshman/util"
  import {deriveEventsAsc} from "@welshman/store"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import CommentTree from "@app/components/CommentTree.svelte"
  import type {FeedContext} from "@app/feeds"
  import CommentCompose from "@app/components/CommentCompose.svelte"
  import {network} from "@app/core"
  import {deriveEventsById} from "@app/repository"
  import {buildCommentTree} from "@app/social"

  type Props = {
    event: TrustedEvent
    url?: string
    context: FeedContext
  }

  const {event, url, context}: Props = $props()

  const relays = removeUndefined([url])
  const filters = getCommentFiltersForRoot([event])
  const comments = deriveEventsAsc(deriveEventsById(filters))

  const nodes = $derived(buildCommentTree(event, $comments))

  const setReplyTo = (comment?: TrustedEvent) => {
    replyTo = comment
  }

  const commentOnRoot = () => setReplyTo(event)

  const clearReplyTo = () => setReplyTo(undefined)

  let replyTo: TrustedEvent | undefined = $state()

  onMount(() => {
    if (relays.length > 0) {
      const controller = new AbortController()

      $network.request({relays, filters, signal: controller.signal})

      return () => controller.abort()
    }
  })
</script>

<div class="flex flex-col gap-3">
  {#each nodes as node (node.comment.id)}
    <CommentTree {node} root={event} {replyTo} {setReplyTo} {url} {context} />
  {/each}
</div>
{#if url}
  {#if replyTo?.id === event.id}
    <CommentCompose {url} {event} onCancel={clearReplyTo} onSubmit={clearReplyTo} />
  {:else}
    <div class="flex justify-end">
      <Button class="button button-primary" onclick={commentOnRoot}>
        <Icon icon={Reply} />
        Add a comment
      </Button>
    </div>
  {/if}
{/if}
