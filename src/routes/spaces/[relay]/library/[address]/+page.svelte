<script lang="ts">
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import {sleep} from "@welshman/lib"
  import type {MakeNonOptional} from "@welshman/lib"
  import {getIdFilters} from "@welshman/util"
  import {request} from "@welshman/net"
  import {fly} from "@lib/transition"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import TrashBin from "@assets/icons/trash-bin-2.svg?dataurl"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Masonry from "@lib/components/Masonry.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import PinItem from "@app/components/PinItem.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import PinboardEdit from "@app/components/PinboardEdit.svelte"
  import PinAdd from "@app/components/PinAdd.svelte"
  import {decodeRelay, deriveSupportedMethods} from "@app/relays"
  import {deriveBoardByAddress, derivePins, deleteBoard, PIN} from "@app/pinboards"
  import {shareEventToChat} from "@app/share"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  const {relay, address} = $page.params as MakeNonOptional<typeof $page.params>
  const url = decodeRelay(relay)

  const board = deriveBoardByAddress(url, address)
  const pins = derivePins(url, address)
  const supportedMethods = deriveSupportedMethods(url)
  const canManage = $derived($supportedMethods.some(m => (m as string) === "signevent"))

  let term = $state("")
  let menuOpen = $state(false)

  const filtered = $derived.by(() => {
    const value = term.trim().toLowerCase()

    if (!value) return $pins

    return $pins.filter(pin =>
      [pin.title, pin.description, pin.value[0] === "i" ? pin.value[1] : "", ...pin.topics].some(
        field => field?.toLowerCase().includes(value),
      ),
    )
  })

  const back = () => history.back()

  const toggleMenu = () => {
    menuOpen = !menuOpen
  }

  const closeMenu = () => {
    menuOpen = false
  }

  const showInfo = () => {
    menuOpen = false

    if ($board) {
      pushModal(EventInfo, {url, event: $board.event})
    }
  }

  const share = () => {
    menuOpen = false

    if ($board) {
      shareEventToChat(url, "Shelf", $board.event)
    }
  }

  const addLink = () => {
    menuOpen = false
    pushModal(PinAdd, {url, address})
  }

  const edit = () => {
    menuOpen = false
    pushModal(PinboardEdit, {url, board: $board})
  }

  const confirmDelete = () => {
    menuOpen = false
    pushModal(Confirm, {
      title: "Delete Shelf",
      message: `Delete "${$board?.title || "this shelf"}"?`,
      confirm: async () => {
        const error = await deleteBoard(url, address)

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Shelf deleted!"})
          back()
        }
      },
    })
  }

  onMount(() => {
    const controller = new AbortController()

    request({
      relays: [url],
      filters: [...getIdFilters([address]), {kinds: [PIN], "#A": [address]}],
      signal: controller.signal,
    })

    return () => controller.abort()
  })
</script>

<SpaceBar {back}>
  {#snippet title()}
    <h1 class="truncate text-xl">{$board?.title || "Shelf"}</h1>
  {/snippet}
  {#snippet action()}
    <div class="relative">
      <Button
        class="button button-neutral button-sm button-square"
        aria-label="More options"
        onclick={toggleMenu}>
        <Icon size={4} icon={MenuDots} />
      </Button>
      {#if menuOpen}
        <Popover hideOnClick onClose={closeMenu}>
          <ul
            transition:fly
            class="menu bg-surface absolute right-0 z-popover mt-2 w-48 gap-1 rounded-2xl p-2">
            <li>
              <Button onclick={showInfo}>
                <Icon icon={Code2} />
                Event details
              </Button>
            </li>
            <li>
              <Button onclick={share}>
                <Icon icon={ShareCircle} />
                Share to chat
              </Button>
            </li>
            {#if canManage}
              <li>
                <Button onclick={addLink}>
                  <Icon icon={AddCircle} />
                  Add link
                </Button>
              </li>
              <li>
                <Button onclick={edit}>
                  <Icon icon={Pen} />
                  Edit shelf
                </Button>
              </li>
              <li>
                <Button class="text-error" onclick={confirmDelete}>
                  <Icon icon={TrashBin} />
                  Delete shelf
                </Button>
              </li>
            {/if}
          </ul>
        </Popover>
      {/if}
    </div>
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  {#if $board}
    {#if $pins.length === 0}
      <div class="flex flex-col items-center gap-4 py-20 text-center">
        <p class="opacity-70">This shelf doesn't have any links yet.</p>
        {#if canManage}
          <Button class="button button-primary" onclick={addLink}>
            <Icon icon={AddCircle} />
            Add a link
          </Button>
        {/if}
      </div>
    {:else}
      <label class="input input-sm input-group flex w-full items-center gap-2">
        <Icon size={4} icon={Magnifier} />
        <input bind:value={term} class="min-w-0 grow" type="text" placeholder="Search links..." />
      </label>
      {#if filtered.length === 0}
        <p class="py-20 text-center opacity-70">No links found.</p>
      {:else}
        <Masonry items={filtered} getKey={pin => pin.id} columnWidth={60} gap={3}>
          {#snippet child(pin)}
            <PinItem {url} {pin} />
          {/snippet}
        </Masonry>
      {/if}
    {/if}
  {:else}
    <div class="flex justify-center py-20">
      {#await sleep(5000)}
        <Spinner loading>Loading shelf...</Spinner>
      {:then}
        <p>Failed to load shelf.</p>
      {/await}
    </div>
  {/if}
</PageContent>
