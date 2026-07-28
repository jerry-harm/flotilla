<script lang="ts">
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import {PIN, PINBOARD} from "@welshman/util"
  import {Pinboards} from "@welshman/app"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import GalleryWide from "@assets/icons/gallery-wide.svg?dataurl"
  import Add from "@assets/icons/add.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Masonry from "@lib/components/Masonry.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import PinboardItem from "@app/components/PinboardItem.svelte"
  import PinboardEdit from "@app/components/PinboardEdit.svelte"
  import {app, network, relays} from "@app/core"
  import {decodeRelay} from "@app/relays"
  import {deriveUserIsSpaceAdmin} from "@app/management"
  import {pushModal} from "@app/modal"

  const url = decodeRelay($page.params.relay!)

  const relay = $relays.one(url)

  const canManage = deriveUserIsSpaceAdmin(url)

  const createBoard = () => pushModal(PinboardEdit, {url})

  let term = $state("")
  let loading = $state(true)

  // Shelves are signed by the relay itself, so the relay's own pubkey scopes them
  // to this space.
  const boards = $derived($app.use(Pinboards).forAuthor($relay?.self ?? "").$)

  const filtered = $derived.by(() => {
    const value = term.trim().toLowerCase()

    if (value) {
      return $boards.filter(board =>
        [board.title(), board.description(), ...board.topics()].some(field =>
          field?.toLowerCase().includes(value),
        ),
      )
    }

    return $boards
  })

  onMount(() => {
    const controller = new AbortController()

    $network
      .load({relays: [url], filters: [{kinds: [PINBOARD, PIN]}], signal: controller.signal})
      .then(() => {
        loading = false
      })

    return () => controller.abort()
  })
</script>

<SpaceBar>
  {#snippet leading()}
    <Icon icon={GalleryWide} />
  {/snippet}
  {#snippet title()}
    <strong>Library</strong>
  {/snippet}
  {#snippet action()}
    {#if $canManage}
      <Button class="button button-primary button-sm" onclick={createBoard}>
        <Icon icon={Add} />
        Create Shelf
      </Button>
    {/if}
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-4 p-4">
  <label class="card input input-group flex w-full items-center gap-2">
    <Icon size={4} icon={Magnifier} />
    <input bind:value={term} class="min-w-0 grow" type="text" placeholder="Search library..." />
  </label>
  <Masonry items={filtered} getKey={board => board.address()} columnWidth={80} gap={4}>
    {#snippet child(board)}
      <PinboardItem {url} {board} />
    {/snippet}
  </Masonry>
  {#if loading}
    <p class="flex items-center justify-center py-20">
      <Spinner loading>Loading library...</Spinner>
    </p>
  {:else if filtered.length === 0}
    <p class="flex flex-col items-center py-20 text-center">No shelves found.</p>
  {/if}
</PageContent>
