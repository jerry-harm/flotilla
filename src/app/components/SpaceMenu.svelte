<script lang="ts">
  import {derived} from "svelte/store"
  import cx from "classnames"
  import {displayRelayUrl, EVENT_TIME, ZAP_GOAL, THREAD, CLASSIFIED, POLL} from "@welshman/util"
  import {deriveRelay, createSearch, pubkey} from "@welshman/app"
  import {fly} from "@lib/transition"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import UsersGroup from "@assets/icons/users-group-rounded.svg?dataurl"
  import Home from "@assets/icons/home.svg?dataurl"
  import GalleryWide from "@assets/icons/gallery-wide.svg?dataurl"
  import Danger from "@assets/icons/danger.svg?dataurl"
  import ServerPath from "@assets/icons/server-path.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Exit from "@assets/icons/logout-3.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import Login from "@assets/icons/login-3.svg?dataurl"
  import History from "@assets/icons/history.svg?dataurl"
  import StarFallMinimalistic from "@assets/icons/star-fall-minimalistic-2.svg?dataurl"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import CaseMinimalistic from "@assets/icons/case-minimalistic.svg?dataurl"
  import Revote from "@assets/icons/revote.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import BellOff from "@assets/icons/bell-off.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import SecondaryNavHeader from "@lib/components/SecondaryNavHeader.svelte"
  import SecondaryNavSection from "@lib/components/SecondaryNavSection.svelte"
  import SpaceInvite from "@app/components/SpaceInvite.svelte"
  import SpaceExit from "@app/components/SpaceExit.svelte"
  import SpaceEdit from "@app/components/SpaceEdit.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import RelayName from "@app/components/RelayName.svelte"
  import SpaceActionItems from "@app/components/SpaceActionItems.svelte"
  import SpaceSearch from "@app/components/SpaceSearch.svelte"
  import RoomCreate from "@app/components/RoomCreate.svelte"
  import SpaceMenuRoomItem from "@app/components/SpaceMenuRoomItem.svelte"
  import VoiceWidget from "@app/components/VoiceWidget.svelte"
  import SocketStatusIndicator from "@app/components/SocketStatusIndicator.svelte"
  import {ENABLE_ZAPS} from "@app/env"
  import {CONTENT_KINDS} from "@app/content"
  import {deriveHostedRelay, HOSTING_ENABLED} from "@app/hosting"
  import {deriveUserCanCreateRoom, deriveUserIsSpaceAdmin} from "@app/members"
  import {
    deriveUserRooms,
    deriveOtherRooms,
    deriveOtherVoiceRooms,
    userSpaceUrls,
    displayRoom,
  } from "@app/groups"
  import {hasNip29, deriveSupportedMethods} from "@app/relays"
  import {BOARD} from "@app/pinboards"
  import {deriveEventsForUrl} from "@app/repository"
  import {deriveSpaceActionItems} from "@app/actionItems"
  import {notificationSettings, deriveShouldNotify, setSpaceNotifications} from "@app/settings"
  import {pushModal} from "@app/modal"
  import {makeSpacePath, goToChat} from "@app/routes"
  import {notifications} from "@app/notifications"

  type Props = {
    url: string
    mobile?: boolean
  }

  const {url, mobile = false}: Props = $props()

  const relay = deriveRelay(url)
  const chatPath = makeSpacePath(url, "chat")
  const goalsPath = makeSpacePath(url, "goals")
  const threadsPath = makeSpacePath(url, "threads")
  const classifiedsPath = makeSpacePath(url, "classifieds")
  const calendarPath = makeSpacePath(url, "calendar")
  const pollsPath = makeSpacePath(url, "polls")
  const userRooms = deriveUserRooms(url)
  const otherRooms = deriveOtherRooms(url)
  const otherVoiceRooms = deriveOtherVoiceRooms(url)
  const userIsAdmin = deriveUserIsSpaceAdmin(url)
  const hostedRelay = deriveHostedRelay(url)
  const actionItems = deriveSpaceActionItems(url)

  const spaceKinds = derived(
    deriveEventsForUrl(url, [{kinds: CONTENT_KINDS}]),
    $events => new Set($events.map(e => e.kind)),
  )

  const boardEvents = deriveEventsForUrl(url, [{kinds: [BOARD]}])
  const supportedMethods = deriveSupportedMethods(url)
  const showLibrary = $derived(
    $boardEvents.length > 0 || $supportedMethods.some(m => (m as string) === "signevent"),
  )

  const roomSearch = derived(otherRooms, $otherRooms =>
    createSearch(
      $otherRooms.map(h => ({h, name: displayRoom(url, h)})),
      {
        getValue: item => item.h,
        fuseOptions: {keys: ["name"]},
      },
    ),
  )

  const openMenu = () => {
    showMenu = true
  }

  const toggleMenu = () => {
    showMenu = !showMenu
  }

  const startEdit = () => pushModal(SpaceEdit, {url, initialValues: $relay || {url}})

  const showActionItems = () => pushModal(SpaceActionItems, {url})

  const openSearch = () => pushModal(SpaceSearch, {url})

  const canCreateRoom = deriveUserCanCreateRoom(url)

  const createInvite = () => pushModal(SpaceInvite, {url})

  const leaveSpace = () => pushModal(SpaceExit, {url})

  const joinSpace = () => pushModal(SpaceJoin, {url})

  const addRoom = () => pushModal(RoomCreate, {url})

  const contactOwner = () => goToChat([$relay!.pubkey!])

  const shouldNotify = deriveShouldNotify(url)

  const toggleSpaceNotifications = () => {
    setSpaceNotifications(url, !$shouldNotify)
  }

  const clearTerm = () => {
    setTimeout(() => {
      term = ""
    }, 100)
  }

  let term = $state("")
  let showMenu = $state(false)
  let element: Element | undefined = $state()
</script>

{#snippet spaceHeader()}
  <Button
    class={cx(
      mobile
        ? "space-menu__header-button text-content"
        : "relative flex w-full flex-col rounded-xl p-3 transition-all hover:bg-surface",
    )}
    onclick={openMenu}>
    <div class="flex items-center justify-between">
      <strong class="flex items-center gap-1 relative">
        <RelayName {url} class="truncate min-w-0" />
        <div
          class="absolute -right-3 top-0 h-2 w-2 rounded-full bg-primary text-primary-content transition-all opacity-0"
          class:opacity-100={$userIsAdmin && $actionItems.length > 0}>
        </div>
        {#if $notificationSettings.push && !$shouldNotify}
          <Icon icon={BellOff} size={3} class="opacity-50" />
        {/if}
      </strong>
      <Icon icon={AltArrowDown} />
    </div>
    <span class="text-xs text-primary">{displayRelayUrl(url)}</span>
  </Button>
  {#if showMenu}
    <Popover hideOnClick onClose={toggleMenu}>
      <ul
        transition:fly
        class="menu absolute z-popover mt-2 w-full gap-1 rounded-2xl bg-surface p-2">
        <li>
          <Button onclick={createInvite}>
            <Icon icon={LinkRound} />
            Create Invite
          </Button>
        </li>
        {#if $userIsAdmin}
          <li>
            <Button onclick={showActionItems}>
              <Icon icon={Danger} />
              Action Items ({$actionItems.length})
              {#if $actionItems.length > 0}
                <div class="h-2 w-2 rounded-full bg-primary text-primary-content"></div>
              {/if}
            </Button>
          </li>
        {/if}
        {#if $relay?.pubkey && $relay.pubkey !== $pubkey}
          <li>
            <Button onclick={contactOwner}>
              <Icon icon={Letter} />
              Contact Owner
            </Button>
          </li>
        {/if}
        <li>
          {#if $notificationSettings.push}
            <Button onclick={toggleSpaceNotifications}>
              <Icon icon={$shouldNotify ? Bell : BellOff} />
              {$shouldNotify ? "Turn off" : "Turn on"} notifications
            </Button>
          {:else}
            <Link href="/settings/alerts">
              <Icon icon={Bell} />
              Enable notifications
            </Link>
          {/if}
        </li>
        {#if HOSTING_ENABLED && $hostedRelay.relay}
          <li>
            <Link href={makeSpacePath(url, "admin")}>
              <Icon icon={ServerPath} />
              Hosting settings
            </Link>
          </li>
        {:else if $userIsAdmin}
          <li>
            <Button onclick={startEdit}>
              <Icon icon={Pen} />
              Edit Space
            </Button>
          </li>
        {/if}
        <li>
          {#if $userSpaceUrls.includes(url)}
            <Button onclick={leaveSpace} class="text-error">
              <Icon icon={Exit} />
              Leave Space
            </Button>
          {:else}
            <Button
              onclick={joinSpace}
              class="bg-primary text-primary-content"
              style="color: var(--primary-content)">
              <Icon icon={Login} />
              Join Space
            </Button>
          {/if}
        </li>
      </ul>
    </Popover>
  {/if}
{/snippet}

{#snippet spaceNavItems()}
  <SecondaryNavItem href={makeSpacePath(url, "about")}>
    <Icon icon={Home} /> Space Details
  </SecondaryNavItem>
  {#if hasNip29($relay)}
    <SecondaryNavItem href={makeSpacePath(url, "recent")}>
      <Icon icon={History} /> Recent Activity
    </SecondaryNavItem>
  {:else}
    <SecondaryNavItem href={chatPath} notification={$notifications.has(chatPath)}>
      <Icon icon={ChatRound} /> Chat
    </SecondaryNavItem>
  {/if}
  <SecondaryNavItem href={makeSpacePath(url, "directory")}>
    <Icon icon={UsersGroup} /> Directory
  </SecondaryNavItem>
  {#if showLibrary}
    <SecondaryNavItem href={makeSpacePath(url, "library")}>
      <Icon icon={GalleryWide} /> Library
    </SecondaryNavItem>
  {/if}
  {#if ENABLE_ZAPS && $spaceKinds.has(ZAP_GOAL)}
    <SecondaryNavItem href={goalsPath}>
      <Icon icon={StarFallMinimalistic} /> Goals
    </SecondaryNavItem>
  {/if}
  {#if $spaceKinds.has(THREAD)}
    <SecondaryNavItem href={threadsPath}>
      <Icon icon={NotesMinimalistic} /> Threads
    </SecondaryNavItem>
  {/if}
  {#if $spaceKinds.has(CLASSIFIED)}
    <SecondaryNavItem href={classifiedsPath}>
      <Icon icon={CaseMinimalistic} /> Classifieds
    </SecondaryNavItem>
  {/if}
  {#if $spaceKinds.has(EVENT_TIME)}
    <SecondaryNavItem href={calendarPath}>
      <Icon icon={CalendarMinimalistic} /> Calendar
    </SecondaryNavItem>
  {/if}
  {#if $spaceKinds.has(POLL)}
    <SecondaryNavItem href={pollsPath}>
      <Icon icon={Revote} /> Polls
    </SecondaryNavItem>
  {/if}
  {#if hasNip29($relay)}
    <SecondaryNavItem onclick={openSearch}>
      <Icon icon={Magnifier} /> Search
    </SecondaryNavItem>
  {/if}
{/snippet}

{#snippet spaceRooms()}
  {#if hasNip29($relay)}
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
  {/if}
{/snippet}

{#snippet spaceFooter()}
  <VoiceWidget />
  <Link
    href={makeSpacePath(url, "about")}
    class={cx(mobile ? "space-menu__status-link" : "button button-neutral button-sm h-10")}>
    <SocketStatusIndicator {url} />
  </Link>
{/snippet}

<div bind:this={element} class="flex min-h-0 flex-1 flex-col">
  {#if mobile}
    <SecondaryNavSection class="space-menu min-h-0 flex-1 flex flex-col gap-3 p-0">
      <div class="card space-menu__card space-menu__header shrink-0 z-nav-item">
        {@render spaceHeader()}
      </div>
      <div class="space-menu__scroll flex flex-col -mt-12 pt-12 -mb-8 pb-8">
        <div class="card space-menu__card flex flex-col gap-1">
          <SecondaryNavHeader>Space</SecondaryNavHeader>
          {@render spaceNavItems()}
        </div>
        {#if hasNip29($relay) && ($userRooms.length > 0 || $otherRooms.length > 0 || $otherVoiceRooms.length > 0 || $canCreateRoom)}
          <div class="card space-menu__card flex flex-col gap-1">
            {@render spaceRooms()}
          </div>
        {/if}
      </div>
      <div class="card space-menu__card space-menu__status shrink-0 z-nav-item">
        {@render spaceFooter()}
      </div>
    </SecondaryNavSection>
  {:else}
    <SecondaryNavSection class="min-h-0 flex-1 flex flex-col pb-0">
      <div class="shrink-0">
        {@render spaceHeader()}
      </div>
      <div
        class="space-menu__scroll flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto py-1">
        {@render spaceNavItems()}
        {@render spaceRooms()}
        <div class="h-5 shrink-0"></div>
      </div>
    </SecondaryNavSection>
    <div class="flex shrink-0 flex-col gap-2 p-2 pt-0 -mt-4 pb-1 md:pb-2 z-nav">
      {@render spaceFooter()}
    </div>
  {/if}
</div>
