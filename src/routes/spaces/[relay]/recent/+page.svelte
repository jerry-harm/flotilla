<script lang="ts">
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import History from "@assets/icons/history.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import {createScroller} from "@lib/html"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import RecentItem from "@app/components/RecentItem.svelte"
  import SpaceSearch from "@app/components/SpaceSearch.svelte"
  import {decodeRelay} from "@app/relays"
  import {deriveRecentActivity} from "@app/recent"
  import {pushModal} from "@app/modal"

  const url = decodeRelay($page.params.relay!)

  const recentActivity = deriveRecentActivity(url)

  const openSearch = () => pushModal(SpaceSearch, {url})

  let limit = $state(20)
  let element: Element | undefined = $state()

  onMount(() => {
    const scroller = createScroller({
      element: element!,
      onScroll: () => {
        limit += 10
      },
    })

    return () => scroller.stop()
  })
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={History} />
  {/snippet}
  {#snippet title()}
    <strong>Recent Activity</strong>
  {/snippet}
  {#snippet action()}
    <Button
      class="button button-neutral button-sm button-square"
      aria-label="Search"
      onclick={openSearch}>
      <Icon size={4} icon={Magnifier} />
    </Button>
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4" bind:element>
  {#if $recentActivity.length === 0}
    <p class="flex flex-col items-center py-20 text-center">No recent activity found!</p>
  {:else}
    {#each $recentActivity.slice(0, limit) as item (item.event.id)}
      <RecentItem {url} {item} />
    {/each}
  {/if}
</PageContent>
