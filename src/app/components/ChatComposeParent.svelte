<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {displayProfileByPubkey} from "@welshman/app"
  import {slide} from "@lib/transition"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"

  const {
    verb,
    event,
    clear,
  }: {
    verb: string
    event: TrustedEvent
    clear: () => void
  } = $props()
</script>

<div
  class="bg-surface-more relative border-l-2 border-solid px-2 py-1 pr-8"
  style="border-color: var(--primary)"
  transition:slide>
  <p class="text-primary text-xs">{verb} @{displayProfileByPubkey(event.pubkey)}</p>
  {#key event.id}
    <NoteContentMinimal trimParent {event} />
  {/key}
  <Button class="absolute right-2 top-2 cursor-pointer" onclick={clear}>
    <Icon icon={CloseCircle} />
  </Button>
</div>
