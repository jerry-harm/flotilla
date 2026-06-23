<script lang="ts">
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Pin from "@app/components/Pin.svelte"
  import {derivePins, type Board} from "@app/pinboards"
  import {makeSpacePath} from "@app/routes"

  type Props = {
    url: string
    board: Board
  }

  const {url, board}: Props = $props()

  const pins = derivePins(url, board.address)
  const detailPath = makeSpacePath(url, "library", board.address)
</script>

<div class="card flex flex-col gap-2">
  <div class="flex flex-col">
    <strong class="text-lg">{board.title || "Untitled shelf"}</strong>
    {#if board.description}
      <span class="text-sm opacity-70">{board.description}</span>
    {/if}
  </div>
  {#each $pins.slice(0, 1) as pin (pin.id)}
    <Pin minimal {url} {pin} />
  {/each}
  <Link href={detailPath} class="button button-primary">
    <Icon icon={AltArrowRight} />
    <strong>View all content</strong>
  </Link>
</div>
