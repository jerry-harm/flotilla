<script lang="ts">
  import {derived} from "svelte/store"
  import {createSearch} from "@welshman/app"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import SecondaryNavHeader from "@lib/components/SecondaryNavHeader.svelte"
  import SpaceMenuRoomItem from "@app/components/SpaceMenuRoomItem.svelte"
  import RoomCreate from "@app/components/RoomCreate.svelte"
  import {relays, roomLists, rooms, user} from "@app/core"
  import {deriveUserCanCreateRoom} from "@app/management"
  import {deriveUserRooms, deriveOtherRooms, deriveOtherVoiceRooms, displayRoom} from "@app/rooms"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    mobile?: boolean
  }

  const {url, mobile = false}: Props = $props()

  const relay = $relays.one(url)
  const userRooms = deriveUserRooms(url)
  const otherRooms = deriveOtherRooms(url)
  const otherVoiceRooms = deriveOtherVoiceRooms(url)
  const canCreateRoom = deriveUserCanCreateRoom(url)

  const roomSearch = derived(otherRooms, $otherRooms =>
    createSearch(
      $otherRooms.map(h => ({h, name: displayRoom(url, h)})),
      {
        getValue: item => item.h,
        fuseOptions: {keys: ["name"]},
      },
    ),
  )

  const addRoom = () => pushModal(RoomCreate, {url})

  const clearTerm = () => {
    setTimeout(() => {
      term = ""
    }, 100)
  }

  let term = $state("")

  // TEMPORARY DIAGNOSTIC
  $effect(() => {
    try {
      console.log(
        "DIAG rooms",
        url,
        "userRooms",
        JSON.stringify($userRooms),
        "otherRooms",
        JSON.stringify($otherRooms),
        "listRooms",
        JSON.stringify($roomLists.roomsForUrl($user.pubkey, url).get()),
        "spaceRooms",
        JSON.stringify(
          $rooms
            .forUrl(url)
            .get()
            .map(room => room.h),
        ),
      )
    } catch (error) {
      console.log("DIAG rooms threw", String(error))
    }
  })
  // END TEMPORARY DIAGNOSTIC
</script>

{#snippet content()}
  {#if $userRooms.length > 0}
    {#if !mobile}
      <div class="h-2 shrink-0"></div>
    {/if}
    <SecondaryNavHeader>Your Rooms</SecondaryNavHeader>
  {/if}
  {#each $userRooms as h (h)}
    <SpaceMenuRoomItem {url} {h} tooltip={!mobile} />
  {/each}
  {#if $otherRooms.length > 0}
    {#if !mobile}
      <div class="h-2 shrink-0"></div>
    {/if}
    <SecondaryNavHeader>
      {#if $userRooms.length > 0}
        Other Rooms
      {:else}
        Rooms
      {/if}
    </SecondaryNavHeader>
  {/if}
  {#if $otherRooms.length > 20}
    <label class="input input-sm flex items-center gap-2">
      <Icon icon={Magnifier} />
      <input bind:value={term} onblur={clearTerm} class="grow" />
    </label>
  {/if}
  {#each $roomSearch.searchValues(term) as h (h)}
    <SpaceMenuRoomItem {url} {h} tooltip={!mobile} />
  {/each}
  {#if $otherVoiceRooms.length > 0}
    {#if !mobile}
      <div class="h-2 shrink-0"></div>
    {/if}
    <SecondaryNavHeader>Voice Rooms</SecondaryNavHeader>
    {#each $otherVoiceRooms as h (h)}
      <SpaceMenuRoomItem {url} {h} tooltip={!mobile} />
    {/each}
  {/if}
  {#if $canCreateRoom}
    <SecondaryNavItem onclick={addRoom}>
      <Icon icon={AddCircle} />
      Create room
    </SecondaryNavItem>
  {/if}
{/snippet}

{#if ($relay?.hasNip(29) ?? false) && ($userRooms.length > 0 || $otherRooms.length > 0 || $otherVoiceRooms.length > 0 || $canCreateRoom)}
  {#if mobile}
    <div class="card space-menu__card flex flex-col gap-1">
      {@render content()}
    </div>
  {:else}
    {@render content()}
  {/if}
{/if}
