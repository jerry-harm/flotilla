<script lang="ts">
  import {onMount} from "svelte"
  import {get} from "svelte/store"
  import {page} from "$app/stores"
  import {randomId} from "@welshman/lib"
  import {deriveRelay} from "@welshman/app"
  import {load} from "@welshman/net"
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
  import {decodeRelay, deriveSupportedMethods} from "@app/relays"
  import {deriveBoards, BOARD, PIN, type Board} from "@app/pinboards"
  import {pushModal} from "@app/modal"

  const url = decodeRelay($page.params.relay!)

  const boards = deriveBoards(url)
  const supportedMethods = deriveSupportedMethods(url)
  const canManage = $derived($supportedMethods.some(m => (m as string) === "signevent"))

  let term = $state("")
  let loading = $state(true)

  const filtered = $derived.by(() => {
    const value = term.trim().toLowerCase()

    if (!value) return $boards

    return $boards.filter(board =>
      [board.title, board.description, ...board.topics].some(field =>
        field?.toLowerCase().includes(value),
      ),
    )
  })

  const createBoard = () => {
    const self = get(deriveRelay(url))?.self ?? ""
    const identifier = randomId()
    const board: Board = {
      address: `${BOARD}:${self}:${identifier}`,
      identifier,
      title: "",
      description: "",
      image: "",
      topics: [],
      collaborative: false,
    }

    pushModal(PinboardEdit, {url, board, isNew: true})
  }

  onMount(() => {
    const controller = new AbortController()

    load({relays: [url], filters: [{kinds: [BOARD, PIN]}], signal: controller.signal}).then(() => {
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
    {#if canManage}
      <Button class="button button-primary button-sm" onclick={createBoard}>
        <Icon icon={Add} />
        Create Shelf
      </Button>
    {/if}
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-4 p-4">
  <div class="card flex flex-col gap-2">
    <label class="input input-sm input-group flex w-full items-center gap-2">
      <Icon size={4} icon={Magnifier} />
      <input bind:value={term} class="min-w-0 grow" type="text" placeholder="Search library..." />
    </label>
    <Masonry items={filtered} getKey={board => board.address} columnWidth={80} gap={2}>
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
  </div>
</PageContent>
