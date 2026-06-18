<script lang="ts">
  import {onMount} from "svelte"
  import {derived, get, writable} from "svelte/store"
  import {sortBy, uniqBy} from "@welshman/lib"
  import {feedFromFilter} from "@welshman/feeds"
  import {NOTE, getReplyTags, getListTags, getEventTagValues} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {derivePinList, makeFeedController} from "@welshman/app"
  import {createScroller} from "@lib/html"
  import {fly} from "@lib/transition"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const pinList = derivePinList(pubkey)
  const pinnedIds = derived(pinList, $pinList => new Set(getEventTagValues(getListTags($pinList))))

  let element: HTMLElement | undefined = $state()
  const events = writable<TrustedEvent[]>([])
  let exhausted = $state(false)
  let buffer: TrustedEvent[] = []

  const ctrl = makeFeedController({
    useWindowing: true,
    feed: feedFromFilter({kinds: [NOTE], authors: [pubkey]}),
    onEvent: (event: TrustedEvent) => {
      if (getReplyTags(event.tags).replies.length === 0 && !get(pinnedIds).has(event.id)) {
        buffer.push(event)
      }
    },
    onExhausted: () => {
      exhausted = true
    },
  })

  onMount(() => {
    const scroller = createScroller({
      element: element!,
      delay: 300,
      threshold: 3000,
      onScroll: () => {
        buffer = uniqBy(
          e => e.id,
          sortBy(e => -e.created_at, buffer),
        )

        events.update($events => uniqBy(e => e.id, [...$events, ...buffer.splice(0, 5)]))

        if (buffer.length < 50) {
          ctrl.load(50)
        }
      },
    })

    return () => scroller.stop()
  })
</script>

<div class="flex flex-col gap-4" bind:this={element}>
  {#each $events as event (event.id)}
    <div in:fly>
      <NoteItem {event} />
    </div>
  {:else}
    {#if exhausted}
      <p class="py-12 text-center text-sm opacity-75">No notes found for this profile.</p>
    {/if}
  {/each}
  {#if !exhausted}
    <p class="my-12 flex items-center justify-center">
      <Spinner loading />
    </p>
  {/if}
</div>
