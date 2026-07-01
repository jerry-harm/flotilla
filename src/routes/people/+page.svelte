<script lang="ts">
  import {onMount} from "svelte"
  import {createScroller, isMobile} from "@lib/html"
  import {profileSearch} from "@welshman/app"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Page from "@lib/components/Page.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import ContentSearch from "@lib/components/ContentSearch.svelte"
  import PeopleItem from "@app/components/PeopleItem.svelte"

  let term = $state("")
  let limit = $state(10)
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

<Page>
  <PageContent>
    <ContentSearch>
      {#snippet input()}
        <label class="flex gap-2 input input-group w-full">
          <Icon icon={Magnifier} />
          <!-- svelte-ignore a11y_autofocus -->
          <input
            autofocus={!isMobile}
            bind:value={term}
            class="grow"
            type="text"
            placeholder="Search for people..." />
        </label>
      {/snippet}
      {#snippet content()}
        <div class="flex flex-col gap-2 h-full" bind:this={element}>
          {#each $profileSearch.searchValues(term).slice(0, limit) as pubkey (pubkey)}
            <PeopleItem {pubkey} />
          {/each}
        </div>
      {/snippet}
    </ContentSearch>
  </PageContent>
</Page>
