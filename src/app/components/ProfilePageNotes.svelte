<script lang="ts">
  import {onMount} from "svelte"
  import {derived, writable} from "svelte/store"
  import type {Writable} from "svelte/store"
  import {sortBy, now} from "@welshman/lib"
  import {NOTE, getReplyTags, getListTags, getEventTagValues} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {derivePinList} from "@welshman/app"
  import {Router} from "@welshman/router"
  import {load} from "@welshman/net"
  import {fly} from "@lib/transition"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {makeFeed} from "@app/feeds"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const pinList = derivePinList(pubkey)
  const pinnedIds = derived(pinList, $pinList => getEventTagValues(getListTags($pinList)))

  $effect(() => {
    if ($pinnedIds.length > 0) {
      const controller = new AbortController()

      load({
        relays: Router.get().FromPubkeys([pubkey]).getUrls(),
        filters: [{ids: $pinnedIds}],
        signal: controller.signal,
        onEvent: e => events.update($events => $events.concat(e)),
      })

      return () => controller.abort()
    }
  })

  let element: HTMLElement | undefined = $state()
  let exhausted = $state(false)
  let events: Writable<TrustedEvent[]> = $state(writable([]))

  const feedEvents = $derived(
    sortBy(
      e => ($pinnedIds.includes(e.id) ? -(now() + e.created_at) : -e.created_at),
      $events.filter(e => getReplyTags(e.tags).replies.length === 0),
    ),
  )

  onMount(() => {
    const feed = makeFeed({
      url: Router.get().FromPubkeys([pubkey]).getUrls()[0],
      element: element!,
      filters: [{kinds: [NOTE], authors: [pubkey]}],
      onBackwardExhausted: () => {
        exhausted = true
      },
    })

    events = feed.events

    return () => feed.cleanup()
  })
</script>

<div class="flex flex-col gap-4" bind:this={element}>
  {#each feedEvents as event (event.id)}
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
