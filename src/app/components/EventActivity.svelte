<script lang="ts">
  import {derived} from "svelte/store"
  import {filter, max, gt, spec, formatTimestampRelative} from "@welshman/lib"
  import {COMMENT} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import type {FeedContext} from "@app/feeds"
  import {deriveChecked} from "@app/notifications"

  const {path, event, context}: {path: string; event: TrustedEvent; context: FeedContext} = $props()

  const checked = deriveChecked(path)
  const related = context.related(event)
  const replies = derived(related, $related => filter(spec({kind: COMMENT}), $related))
  const lastActive = $derived(max([...$replies, event].map(e => e.created_at)))
</script>

<div class="flex-inline button button-neutral button-xs gap-1 rounded-full">
  <Icon icon={Reply} />
  <span>{$replies.length} {$replies.length === 1 ? "reply" : "replies"}</span>
</div>
<div class="button button-neutral button-xs relative rounded-full">
  {#if gt(lastActive, $checked)}
    <div class="h-2 w-2 rounded-full bg-primary text-primary-content"></div>
  {/if}
  Active {formatTimestampRelative(lastActive)}
</div>
