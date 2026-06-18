<script lang="ts">
  import {derived} from "svelte/store"
  import {sortBy} from "@welshman/lib"
  import {getListTags, getEventTagValues} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import {derivePinList, repository} from "@welshman/app"
  import {Router} from "@welshman/router"
  import {load} from "@welshman/net"
  import {deriveEventsById, deriveEventsDesc} from "@welshman/store"
  import {fly} from "@lib/transition"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteItem from "@app/components/NoteItem.svelte"

  type Props = {
    pubkey: string
  }

  const {pubkey}: Props = $props()

  const pinList = derivePinList(pubkey)

  const pinnedIds = derived(pinList, $pinList => getEventTagValues(getListTags($pinList)))

  const pinnedEvents = derived(
    pinnedIds,
    ($pinnedIds, set) => {
      if ($pinnedIds.length === 0) {
        set([])

        return
      }

      return deriveEventsDesc(
        deriveEventsById({repository, filters: [{ids: $pinnedIds}]}),
      ).subscribe(events => {
        set(sortBy(event => -$pinnedIds.indexOf(event.id), events))
      })
    },
    [] as TrustedEvent[],
  )

  let fetching = $state(false)

  $effect(() => {
    const ids = $pinnedIds

    if (ids.length === 0) {
      fetching = false

      return
    }

    const missing = ids.filter(id => !repository.getEvent(id))

    if (missing.length === 0) {
      fetching = false

      return
    }

    fetching = true

    const controller = new AbortController()

    load({
      relays: Router.get().FromPubkeys([pubkey]).getUrls(),
      filters: [{ids: missing}],
      signal: controller.signal,
      onClose: () => {
        fetching = false
      },
    })

    return () => controller.abort()
  })

  const loading = $derived(
    fetching || ($pinnedIds.length > 0 && $pinnedEvents.length < $pinnedIds.length),
  )
</script>

{#if $pinnedIds.length > 0 || loading}
  {#if loading && $pinnedEvents.length === 0}
    <p class="flex items-center justify-center py-8">
      <Spinner loading />
    </p>
  {:else if $pinnedEvents.length > 0}
    <div class="flex flex-col gap-4">
      {#each $pinnedEvents as event (event.id)}
        <div in:fly>
          <NoteItem {event} />
        </div>
      {/each}
    </div>
  {/if}
{/if}
