<script lang="ts">
  import Server from "@assets/icons/server.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Card from "@lib/components/Card.svelte"
  import Link from "@lib/components/Link.svelte"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {displayUrl} from "@welshman/lib"
  import {displayRelayUrl} from "@welshman/util"
  import {deriveRelay, deriveRelayStats} from "@welshman/app"

  const {url, children} = $props()

  const relay = deriveRelay(url)
  const relayStats = deriveRelayStats(url)
  const connections = $derived($relayStats?.open_count || 0)
</script>

<Card sm class="flex flex-col gap-2">
  <div class="flex items-center justify-between gap-4">
    <div class="truncate min-w-0 flex items-center gap-2">
      <Icon icon={Server} />
      <p class="truncate min-w-0">{displayRelayUrl(url)}</p>
    </div>
    {@render children?.()}
  </div>
  {#if $relay?.description}
    <ContentMinimal singleLine event={{content: $relay.description, tags: []}} />
  {/if}
  <span class="flex items-center gap-1 whitespace-nowrap text-sm">
    {#if $relay?.contact}
      <Link external class="truncate min-w-0 underline" href={$relay.contact}
        >{displayUrl($relay.contact)}</Link>
      &bull;
    {/if}
    {#if Array.isArray($relay?.supported_nips)}
      <span
        class="tip cursor-pointer underline"
        data-tip="NIPs supported: {$relay.supported_nips.join(', ')}">
        {$relay.supported_nips.length} NIPs
      </span>
      &bull;
    {/if}
    Connected {connections}
    {connections === 1 ? "time" : "times"}
  </span>
</Card>
