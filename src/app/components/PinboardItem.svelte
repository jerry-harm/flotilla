<script lang="ts">
  import {Pins} from "@welshman/app"
  import type {PinboardReader} from "@welshman/domain"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import PinItem from "@app/components/PinItem.svelte"
  import BoardMenu from "@app/components/BoardMenu.svelte"
  import {app} from "@app/core"
  import {makeLibraryPath} from "@app/routes"

  type Props = {
    url: string
    board: PinboardReader
  }

  const {url, board}: Props = $props()

  const pins = $app.use(Pins).forBoard(board.address()).$
  const detailPath = makeLibraryPath(url, board.address())
</script>

<div class="card relative flex flex-col gap-2">
  <div class="absolute right-2 top-2 z-feature">
    <MenuButton
      class="button button-neutral button-sm button-square"
      aria-label="More options"
      iconSize={4}
      component={BoardMenu}
      componentProps={{url, board}} />
  </div>
  <div class="flex flex-col pr-8">
    <strong class="text-lg">{board.title() || "Untitled shelf"}</strong>
    {#if board.description()}
      <span class="text-sm opacity-70">{board.description()}</span>
    {/if}
  </div>
  {#each $pins.slice(0, 1) as pin (pin.id())}
    <PinItem minimal {url} {pin} />
  {/each}
  <Link href={detailPath} class="button button-primary">
    <Icon icon={AltArrowRight} />
    <strong>View all content</strong>
  </Link>
</div>
