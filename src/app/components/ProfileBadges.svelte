<script lang="ts">
  import {onMount} from "svelte"
  import {formatTimestampRelative} from "@welshman/lib"
  import {NOTE, ROOMS, COMMENT, MESSAGE, outbox} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import ProfileSpaces from "@app/components/ProfileSpaces.svelte"
  import {network, relayLists, roomLists, router} from "@app/core"
  import {deriveEvents} from "@app/repository"
  import {goToEvent} from "@app/routes"
  import {pushModal} from "@app/modal"

  type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()

  const events = deriveEvents([{authors: [pubkey], limit: 1}])

  const spaceUrls = $roomLists.urls(pubkey).$

  const viewEvent = () => goToEvent($events[0]!)

  const openSpaces = () => pushModal(ProfileSpaces, {pubkey, url})

  onMount(async () => {
    await $relayLists.load(pubkey)

    $network.load({
      filters: [
        {authors: [pubkey], kinds: [ROOMS]},
        {authors: [pubkey], limit: 1, kinds: [NOTE, COMMENT, MESSAGE]},
      ],
      relays: await $router.resolver.relays([outbox(pubkey)]),
    })
  })
</script>

<div class="flex flex-wrap gap-2">
  {#if $events.length > 0}
    <Button onclick={viewEvent} class="badge badge-neutral">
      Last active {formatTimestampRelative($events[0].created_at)}
    </Button>
  {/if}
  {#if $spaceUrls.length > 0}
    <Button onclick={openSpaces} class="badge badge-neutral">
      {$spaceUrls.length}
      {$spaceUrls.length === 1 ? "space" : "spaces"}
    </Button>
  {/if}
</div>
