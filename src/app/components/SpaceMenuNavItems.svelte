<script lang="ts">
  import {derived} from "svelte/store"
  import {EVENT_TIME, ZAP_GOAL, THREAD, CLASSIFIED, PINBOARD, POLL} from "@welshman/util"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import UsersGroup from "@assets/icons/users-group-rounded.svg?dataurl"
  import Home from "@assets/icons/home.svg?dataurl"
  import GalleryWide from "@assets/icons/gallery-wide.svg?dataurl"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import History from "@assets/icons/history.svg?dataurl"
  import StarFallMinimalistic from "@assets/icons/star-fall-minimalistic-2.svg?dataurl"
  import NotesMinimalistic from "@assets/icons/notes-minimalistic.svg?dataurl"
  import CalendarMinimalistic from "@assets/icons/calendar-minimalistic.svg?dataurl"
  import CaseMinimalistic from "@assets/icons/case-minimalistic.svg?dataurl"
  import Revote from "@assets/icons/revote.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import SecondaryNavItem from "@lib/components/SecondaryNavItem.svelte"
  import SpaceSearch from "@app/components/SpaceSearch.svelte"
  import {relays} from "@app/core"
  import {ENABLE_ZAPS} from "@app/env"
  import {CONTENT_KINDS} from "@app/content"
  import {deriveSpaceSupportedMethods} from "@app/management"
  import {deriveEventsForUrl} from "@app/repository"
  import {makeSpacePath} from "@app/routes"
  import {notifications} from "@app/notifications"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = $relays.one(url)
  const chatPath = makeSpacePath(url, "chat")
  const goalsPath = makeSpacePath(url, "goals")
  const threadsPath = makeSpacePath(url, "threads")
  const classifiedsPath = makeSpacePath(url, "classifieds")
  const calendarPath = makeSpacePath(url, "calendar")
  const pollsPath = makeSpacePath(url, "polls")

  const spaceKinds = derived(
    deriveEventsForUrl(url, [{kinds: CONTENT_KINDS}]),
    $events => new Set($events.map(e => e.kind)),
  )

  const boardEvents = deriveEventsForUrl(url, [{kinds: [PINBOARD]}])
  const hasNip29 = $derived($relay?.hasNip(29) ?? false)
  const supportedMethods = deriveSpaceSupportedMethods(url)
  const showLibrary = $derived($boardEvents.length > 0 || $supportedMethods.includes("signevent"))

  const openSearch = () => pushModal(SpaceSearch, {url})
</script>

<SecondaryNavItem href={makeSpacePath(url, "about")}>
  <Icon icon={Home} /> Space Details
</SecondaryNavItem>
{#if hasNip29}
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
{#if hasNip29}
  <SecondaryNavItem onclick={openSearch}>
    <Icon icon={Magnifier} /> Search
  </SecondaryNavItem>
{/if}
