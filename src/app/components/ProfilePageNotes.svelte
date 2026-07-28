<script lang="ts">
  import {onMount} from "svelte"
  import {derived, writable} from "svelte/store"
  import type {Writable} from "svelte/store"
  import {sortBy, uniqBy, now} from "@welshman/lib"
  import {NOTE, outbox} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {getReplyTags} from "@welshman/domain"
  import {PinLists} from "@welshman/app"
  import {fly} from "@lib/transition"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"
  import {app, network, router} from "@app/core"
  import {makeFeed} from "@app/feeds"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const relays = $router.resolver.relays([outbox(pubkey)])
  const pinnedIds = derived($app.use(PinLists).one(pubkey), $pinList => $pinList?.ids() ?? [])

  $effect(() => {
    if ($pinnedIds.length > 0) {
      const controller = new AbortController()

      relays.then($relays =>
        $network.load({
          relays: $relays,
          filters: [{ids: $pinnedIds}],
          signal: controller.signal,
          onEvent: e => events.update($events => uniqBy(e => e.id, $events.concat(e))),
        }),
      )

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
    let cleanup: (() => void) | undefined

    relays.then($relays => {
      const feed = makeFeed({
        relays: $relays,
        element: element!,
        filters: [{kinds: [NOTE], authors: [pubkey]}],
        onBackwardExhausted: () => {
          exhausted = true
        },
      })

      events = feed.events
      cleanup = feed.cleanup
    })

    return () => cleanup?.()
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
    <p class="my-12 flex items-center justify-center gap-2">
      <Spinner loading />
      Loading notes...
    </p>
  {/if}
</div>
