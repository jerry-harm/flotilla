<script lang="ts">
  import {onMount} from "svelte"
  import {max, gt, formatTimestampRelative} from "@welshman/lib"
  import {getCommentFiltersForRoot} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {deriveEvents} from "@app/repository"
  import {network} from "@app/core"
  import {deriveChecked} from "@app/notifications"

  const {url, path, event}: {url: string; path: string; event: TrustedEvent} = $props()

  const checked = deriveChecked(path)
  const filters = getCommentFiltersForRoot([event])
  const replies = deriveEvents(filters)
  const lastActive = $derived(max([...$replies, event].map(e => e.created_at)))

  onMount(() => {
    $network.load({relays: [url], filters})
  })
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
