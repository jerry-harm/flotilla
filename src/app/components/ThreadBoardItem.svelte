<script lang="ts">
  import {formatTimestamp, max} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {COMMENT, getTagValue} from "@welshman/util"
  import {goto} from "$app/navigation"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileName from "@app/components/ProfileName.svelte"
  import {deriveEventsForUrl} from "@app/repository"
  import {makeThreadPath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const filters = [{kinds: [COMMENT], "#E": [event.id]}]
  const replies = deriveEventsForUrl(url, filters)
  const replyCount = $derived($replies.length)
  const lastActive = $derived(max([...$replies, event].map(e => e.created_at)))
  const title = getTagValue("title", event.tags)
  const path = makeThreadPath(url, event.id)
  const goToThread = () => goto(path)
</script>

<tr
  class="cursor-pointer transition-colors hover:bg-surface-less text-sm border-b border-solid border-line"
  onclick={goToThread}>
  <td class="px-4 py-3 align-top ellipsize">
    {title || "Untitled thread"}
  </td>
  <td class="px-4 py-3 align-middle flex items-center gap-2">
    <ProfileCircle pubkey={event.pubkey} {url} size={5} />
    <span class="ellipsize">
      <ProfileName pubkey={event.pubkey} {url} />
    </span>
  </td>
  <td class="px-4 py-3 align-middle text-right">
    {replyCount}
  </td>
  <td class="whitespace-nowrap px-4 py-2 align-middle text-right">
    {formatTimestamp(lastActive)}
  </td>
</tr>
