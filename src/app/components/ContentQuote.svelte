<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {Router} from "@welshman/router"
  import type {TrustedEvent} from "@welshman/util"
  import {Address, MESSAGE} from "@welshman/util"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import {deriveEvent} from "@app/repository"
  import {entityLink} from "@app/env"
  import {goToEvent} from "@app/routes"

  type Props = {
    value: any
    event: TrustedEvent
    url?: string
  }

  const {value, event, url}: Props = $props()

  const {id, identifier, kind, pubkey, relays = []} = value
  const idOrAddress = id || new Address(kind, pubkey, identifier).toString()
  const mergedRelays = Router.get().Quote(event, idOrAddress, relays).getUrls()

  if (url) {
    mergedRelays.push(url)
  }

  const quote = deriveEvent(idOrAddress, mergedRelays)
  const entity = id
    ? nip19.neventEncode({id, relays: mergedRelays})
    : new Address(kind, pubkey, identifier, mergedRelays).toNaddr()

  const onclick = () => {
    if ($quote) {
      goToEvent($quote)
    } else {
      window.open(entityLink(entity))
    }
  }
</script>

<Button class="my-2 block w-full max-w-full text-left" {onclick}>
  {#if $quote}
    {#if $quote.content.trim().match(/^(nostr:)?nevent1[a-z0-9]+$/)}
      <NoteContent {url} event={$quote} />
    {:else if $quote.kind === MESSAGE}
      <div
        class="border-l-2 border-solid py-1 pl-2 opacity-90"
        style="border-left-color: var(--primary); background-color: color-mix(in srgb, var(--primary) 10%, var(--surface-more) 90%);">
        <NoteContentMinimal trimParent {url} event={$quote} />
      </div>
    {:else}
      <NoteCard
        event={$quote}
        {url}
        class="border border-solid rounded-2xl p-4"
        style="border-color: var(--line)">
        <NoteContentMinimal {url} event={$quote} />
      </NoteCard>
    {/if}
  {:else}
    <div class="rounded-2xl p-4">
      <Spinner loading>Loading event...</Spinner>
    </div>
  {/if}
</Button>
