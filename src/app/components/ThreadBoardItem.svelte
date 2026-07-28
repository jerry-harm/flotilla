<script lang="ts">
  import {goto} from "$app/navigation"
  import {formatTimestamp, max} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {COMMENT, tagSpec, tagValue} from "@welshman/util"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {deriveEventsForUrl} from "@app/repository"
  import {makeThreadPath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    mobile?: boolean
  }

  const {url, event, mobile = false}: Props = $props()

  const filters = [{kinds: [COMMENT], "#E": [event.id]}]
  const replies = deriveEventsForUrl(url, filters)
  const replyCount = $derived($replies.length)
  const lastActive = $derived(max([...$replies, event].map(e => e.created_at)))
  const title = tagValue(tagSpec("title"), event.tags)
  const path = makeThreadPath(url, event.id)

  const goToThread = () => goto(path)
</script>

{#if mobile}
  <button
    type="button"
    class="hover:bg-surface-less flex w-full flex-col gap-2 border-b border-solid border-line px-4 py-3 text-left text-sm transition-colors"
    onclick={goToThread}>
    <p class="truncate font-medium">{title || "Untitled thread"}</p>
    <div class="text-content-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span class="flex min-w-0 items-center gap-1.5">
        <ProfileCircle pubkey={event.pubkey} {url} size={4} />
        <span class="truncate">
          <ProfileName pubkey={event.pubkey} {url} />
        </span>
      </span>
      <span>{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
      <span>{formatTimestamp(lastActive)}</span>
    </div>
  </button>
{:else}
  <tr
    class="hover:bg-surface-less cursor-pointer border-b border-solid border-line text-sm transition-colors"
    onclick={goToThread}>
    <td class="max-w-0 truncate px-4 py-3 align-top">
      {title || "Untitled thread"}
    </td>
    <td class="w-32 px-4 py-3 align-middle">
      <div class="flex min-w-0 items-center gap-2">
        <ProfileCircle pubkey={event.pubkey} {url} size={5} />
        <span class="min-w-0 truncate">
          <ProfileName pubkey={event.pubkey} {url} />
        </span>
      </div>
    </td>
    <td class="w-20 px-4 py-3 text-center align-middle">
      {replyCount}
    </td>
    <td class="w-32 whitespace-nowrap px-4 py-3 text-right align-middle">
      {formatTimestamp(lastActive)}
    </td>
  </tr>
{/if}
