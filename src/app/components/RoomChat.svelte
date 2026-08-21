<script lang="ts">
  import {onDestroy, onMount} from "svelte"
  import {readable} from "svelte/store"
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import type {Readable} from "svelte/store"
  import {debounce} from "throttle-debounce"
  import cx from "classnames"
  import {now, ifLet, int, formatTimestampAsDate, ago, MINUTE} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {makeEvent, MESSAGE, RELAY_ADD_MEMBER, ROOM_ADD_MEMBER} from "@welshman/util"
  import {MembershipStatus} from "@welshman/app"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import Login2 from "@assets/icons/login-3.svg?dataurl"
  import Close from "@assets/icons/close.svg?dataurl"
  import {fade, fly} from "@lib/transition"
  import {documentActive} from "@lib/html"
  import Button from "@lib/components/Button.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import RoomCompose from "@app/components/RoomCompose.svelte"
  import RoomComposeEdit from "@app/components/RoomComposeEdit.svelte"
  import RoomComposeParent from "@app/components/RoomComposeParent.svelte"
  import RoomItem from "@app/components/RoomItem.svelte"
  import RoomItemAddMember from "@app/components/RoomItemAddMember.svelte"
  import RoomPinnedMessages from "@app/components/RoomPinnedMessages.svelte"
  import ThunkToast from "@app/components/ThunkToast.svelte"
  import VideoCallContent from "@app/components/VideoCallContent.svelte"
  import CallControlBar from "@app/components/CallControlBar.svelte"
  import {deletes, relays, rooms, thunks, user} from "@app/core"
  import {joinRoom, leaveRoom} from "@app/access"
  import {CallState, callTargetRoom, callState, VideoCallLayout, videoCallLayout} from "@app/call"
  import {
    PROTECTED,
    RoomType,
    deriveUserRoomMembershipStatus,
    getRoomType,
    prependParent,
  } from "@app/rooms"
  import {userSettingsValues} from "@app/settings"
  import {makeFeed} from "@app/feeds"
  import {checked, deferredRoomPath, setChecked} from "@app/notifications"
  import {makeRoomPath} from "@app/routes"
  import {pendingShare, type Share} from "@app/share"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    h?: string
  }

  const {url, h}: Props = $props()

  const room = h ? $rooms.forRoom(url, h) : readable(undefined)
  const addMemberKind = h ? ROOM_ADD_MEMBER : RELAY_ADD_MEMBER
  const isVoiceRoom = $derived($room && getRoomType($room) === RoomType.Voice)

  const isCallTargetingThisRoom = $derived($callTargetRoom?.url === url && $callTargetRoom?.h === h)

  const voiceConnectedHere = $derived(
    isVoiceRoom && $callState === CallState.Connected && isCallTargetingThisRoom,
  )

  // Reuses voiceConnectedHere (rather than re-deriving isVoiceRoom/callState) so it
  // can't diverge and stay true for a different voice room the call isn't targeting
  // — that previously hid this room's messages/compose row while connected elsewhere.
  const showMobileVideoPanel = $derived(
    voiceConnectedHere && $videoCallLayout === VideoCallLayout.Video,
  )

  // Basic pass at issue #121's "chat overlaid on video" idea: float the chat panel over
  // the full-bleed video instead of splitting the screen into fixed columns, so the call
  // stays the visual focus. The panel opens from — and collapses back to — a chat FAB.
  const isOverlayChat = $derived(voiceConnectedHere && $videoCallLayout === VideoCallLayout.Split)

  const videoCallChatHidden = $derived(
    voiceConnectedHere && $videoCallLayout === VideoCallLayout.Video,
  )

  const roomPath = h ? makeRoomPath(url, h) : undefined

  const closeChat = () => videoCallLayout.set(VideoCallLayout.Video)

  $effect(() => {
    deferredRoomPath.set(videoCallChatHidden ? roomPath : undefined)
    if (roomPath && voiceConnectedHere && !videoCallChatHidden) {
      setChecked(roomPath)
    }
    // The messages pane (and its scroll position) is offscreen while the call view is
    // showing — don't leave its floating "scroll down"/"new messages" chips stranded.
    if (videoCallChatHidden) {
      showScrollButton = false
      showFixedNewMessages = false
    }
  })

  onDestroy(() => deferredRoomPath.set(undefined))

  let wasConnectedHere = $state(false)

  $effect(() => {
    if (!voiceConnectedHere) {
      if ($callState !== CallState.Connected) {
        videoCallLayout.set(VideoCallLayout.Chat)
      }
      wasConnectedHere = false
      return
    }

    // Land on the call view (chat as a FAB) as soon as the call starts here, whether
    // or not anyone's camera is on — chat is one tap away via the FAB.
    if (!wasConnectedHere) {
      videoCallLayout.set(VideoCallLayout.Video)
      wasConnectedHere = true
    }
  })

  const shouldProtect = $relays.hasNip(url, 70)
  const membershipStatus = h
    ? deriveUserRoomMembershipStatus(url, h)
    : readable(MembershipStatus.Granted)
  const at = $derived(parseInt($page.url.searchParams.get("at")!))
  const inviteCode = $derived($page.url.searchParams.get("code") || "")

  const join = async () => {
    if (h) {
      joining = true

      try {
        const message = await joinRoom(url, h, inviteCode)

        if (message) {
          pushToast({theme: "error", message})
        } else {
          // Restart the feed now that we're a member
          start()
        }
      } finally {
        joining = false
      }
    }
  }

  const leave = async () => {
    if (h) {
      leaving = true

      try {
        const message = await leaveRoom(url, h)

        if (message) {
          pushToast({theme: "error", message})
        } else {
          pushToast({message: "You have left the room."})
        }
      } finally {
        leaving = false
      }
    }
  }

  const replyTo = (event: TrustedEvent) => {
    parent = event
    compose?.focus()
  }

  const clearParent = () => {
    parent = undefined
  }

  const clearShare = () => {
    share = undefined
  }

  const clearEventToEdit = () => {
    eventToEdit = undefined
  }

  const onSubmit = async ({content, tags}: EventContent) => {
    if (!content && !sharedEvent) {
      return
    }

    try {
      if (h) {
        tags.push(["h", h])
      }

      const protect = await shouldProtect

      if (protect) {
        tags.push(PROTECTED)
      }

      let template: EventContent & {created_at?: number} = {content, tags}

      if (eventToEdit) {
        // Don't do anything if message hasn't changed
        if (eventToEdit.content === content) {
          return
        }

        // Delete previous message, to be republished with same timestamp
        template.created_at = eventToEdit.created_at

        const command = await $deletes.deleteEvent($state.snapshot(eventToEdit), w =>
          w.setProtected(protect),
        )

        command.publishToRelays([url])
      }

      if (sharedEvent) {
        template = await prependParent(sharedEvent, template, url)
      }

      if (parent) {
        template = await prependParent(parent, template, url)
      }

      const thunk = $thunks.publish({
        relays: [url],
        event: makeEvent(MESSAGE, template),
        delay: $userSettingsValues.send_delay,
      })

      if ($userSettingsValues.send_delay) {
        pushToast({
          timeout: 30_000,
          children: {
            component: ThunkToast,
            props: {thunk},
          },
        })
      }
    } finally {
      clearParent()
      clearShare()
      clearEventToEdit()
    }
  }

  const manageScrollPosition = () => {
    // Only treat an `at` jump as "scrolled up" when it targets an event below the
    // newest one; jumping to the most recent message already lands us at the bottom.
    const newestEvent = $events[$events.length - 1]
    const atIsBelowNewest = !isNaN(at) && newestEvent !== undefined && at < newestEvent.created_at

    showScrollButton = atIsBelowNewest || Math.abs(element?.scrollTop || 0) > 1500

    const newMessages = document.getElementById("new-messages")

    if (newMessagesSeen) {
      showFixedNewMessages = false
    } else if (newMessages) {
      const {y} = newMessages.getBoundingClientRect()

      if (y > 0 && y < 300) {
        newMessagesSeen = true
        showFixedNewMessages = false
      } else {
        showFixedNewMessages = y < 0
      }
    }

    if (!userHasScrolled && !isNaN(at)) {
      const targetEvent = $events.find(event => event.created_at >= at)

      if (targetEvent) {
        const target = element?.querySelector(`[data-event="${targetEvent.id}"]`)

        if (target instanceof HTMLElement) {
          isProgrammaticScroll = true
          target.scrollIntoView({block: "center"})
        }
      }
    }
  }

  const onScroll = () => {
    if (!isProgrammaticScroll) {
      userHasScrolled = true
      isUserScrolling = true
      clearIsUserScrolling()
      manageScrollPosition()
    }

    isProgrammaticScroll = false
  }

  const scrollToNewMessages = () =>
    document.getElementById("new-messages")?.scrollIntoView({behavior: "smooth", block: "center"})

  const scrollToBottom = () => {
    if (!isNaN(at)) {
      goto($page.url.pathname, {replaceState: true})
    } else {
      element?.scrollTo({top: 0, behavior: "smooth"})
    }
  }

  // A tab can be `visible` but unfocused (user alt-tabbed to another app), so we
  // can't rely on document.hidden alone to know the room is actually being watched.
  const onActiveChange = (active: boolean) => {
    if (!active) {
      lastVisibleAt = now()
    } else if ($events.some(e => e.pubkey !== $user.pubkey && e.created_at > lastVisibleAt)) {
      newMessagesAfter = lastVisibleAt
      newMessagesBefore = now()
      newMessagesSeen = false
    }
  }

  let joining = $state(false)
  let leaving = $state(false)
  let userHasScrolled = $state(false)
  let isProgrammaticScroll = $state(false)
  let isUserScrolling = $state(false)
  let loadingBackward = $state(true)
  let loadingForward = $state(true)
  let share: Maybe<Share> = $state()
  let parent: TrustedEvent | undefined = $state()
  let element: HTMLElement | undefined = $state()
  let lastVisibleAt = now()
  let newMessagesAfter = $state($checked[$page.url.pathname])
  let newMessagesBefore = $state(now())
  let newMessagesSeen = false
  let showFixedNewMessages = $state(false)
  let showScrollButton = $state(false)
  let cleanup: () => void
  let events: Readable<TrustedEvent[]> = $state(readable([]))
  let compose: RoomCompose | undefined = $state()
  let eventToEdit: TrustedEvent | undefined = $state()

  // Claim the share once we're on screen. Sharing into the room you're already looking at
  // doesn't re-create this component, so this can't be read once on mount.
  $effect(() => {
    if ($pendingShare) {
      share = $pendingShare
      pendingShare.set(undefined)
    }
  })

  const sharedEvent = $derived(share?.type === "event" ? share.value : undefined)

  const initialValues = $derived.by((): Share | undefined => {
    if (eventToEdit) {
      return {type: "text", value: eventToEdit.content}
    }

    if (share) {
      return share
    }
  })

  const clearIsUserScrolling = debounce(150, () => {
    isUserScrolling = false
  })

  const elements = $derived.by(() => {
    const elements = []
    const seen = new Set()

    let previousDate
    let previousKind
    let previousPubkey
    let previousCreatedAt = 0
    let newMessagesSeen = false

    if (events) {
      const lastUserEvent = $events.findLast(e => e.pubkey === $user.pubkey)

      // Adjust the boundary to account for messages that came from a different device
      const adjustedAfter =
        newMessagesAfter && lastUserEvent
          ? Math.max(lastUserEvent.created_at, newMessagesAfter)
          : newMessagesAfter

      for (const event of $events) {
        if (seen.has(event.id)) {
          continue
        }

        const date = formatTimestampAsDate(event.created_at)

        if (
          !newMessagesSeen &&
          adjustedAfter &&
          event.pubkey !== $user.pubkey &&
          event.created_at > adjustedAfter &&
          event.created_at < newMessagesBefore
        ) {
          elements.push({type: "new-messages", id: "new-messages"})
          newMessagesSeen = true
        }

        if (date !== previousDate) {
          elements.push({type: "date", value: date, id: date, showPubkey: false})
        }

        const showPubkey =
          previousPubkey !== event.pubkey ||
          event.created_at - previousCreatedAt > int(3, MINUTE) ||
          previousKind === addMemberKind

        elements.push({
          id: event.id,
          type: "note",
          value: event,
          showPubkey,
        })

        previousDate = date
        previousKind = event.kind
        previousPubkey = event.pubkey
        previousCreatedAt = event.created_at
        seen.add(event.id)
      }
    }

    elements.reverse()

    return elements
  })

  $effect(() => {
    if (elements.length > 0 && !isUserScrolling) {
      requestAnimationFrame(manageScrollPosition)
    }
  })

  const start = () => {
    cleanup?.()

    const feed = makeFeed({
      relays: [url],
      at: at || now(),
      element: element!,
      filters: [
        h ? {kinds: [MESSAGE, addMemberKind], "#h": [h]} : {kinds: [MESSAGE, addMemberKind]},
      ],
      onBackwardExhausted: () => {
        loadingBackward = false
      },
      onForwardExhausted: () => {
        loadingForward = false
      },
    })

    events = feed.events
    cleanup = feed.cleanup
  }

  const onEscape = () => {
    clearParent()
    clearShare()
    eventToEdit = undefined
  }

  const canEditEvent = (event: TrustedEvent) =>
    event.pubkey === $user.pubkey && event.created_at >= ago(5, MINUTE)

  const onEditEvent = (event: TrustedEvent) => {
    clearParent()
    clearShare()
    eventToEdit = event
  }

  const onEditPrevious = () => ifLet($events.toReversed().find(canEditEvent), onEditEvent)

  onMount(() => {
    // Defer rendering until navigation finishes
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(start)
    })

    const unsubscribeActive = documentActive.subscribe(onActiveChange)

    return () => {
      cleanup?.()
      unsubscribeActive()
      cancelAnimationFrame(frame)
    }
  })
</script>

<div class={cx("flex min-h-0 flex-1 flex-col", isOverlayChat && "relative")}>
  {#if h && voiceConnectedHere}
    <VideoCallContent
      layout={$videoCallLayout}
      {url}
      {h}
      class={cx(
        "hidden min-h-0 w-full min-w-0 flex-1 flex-col md:flex",
        isOverlayChat && "md:absolute md:inset-0",
      )} />
  {/if}

  {#if h && voiceConnectedHere}
    <VideoCallContent
      layout={$videoCallLayout}
      mobile
      {url}
      {h}
      class={cx("md:hidden", isOverlayChat && "absolute inset-0")} />
  {/if}

  <div
    class={cx(
      "room flex min-h-0 min-w-0 flex-1 flex-col",
      videoCallChatHidden && "hidden",
      isOverlayChat &&
        "absolute inset-x-2 top-4 bottom-[calc(3.5rem+var(--saib))] z-popover overflow-hidden rounded-2xl border border-line bg-surface/95 shadow-lg md:left-auto md:right-4 md:bottom-4 md:w-96 md:max-w-[26rem] md:bg-surface/90",
    )}>
    {#if isOverlayChat}
      <Button
        aria-label="Close room chat"
        class="button button-neutral button-xs button-circle absolute right-2 top-2 z-popover"
        onclick={closeChat}>
        <Icon icon={Close} size={4} />
      </Button>
    {/if}

    {#if h}
      <RoomPinnedMessages {url} {h} />
    {/if}

    <div
      bind:this={element}
      onscroll={onScroll}
      class={cx(
        "room__content scroll-container",
        showMobileVideoPanel ? "hidden md:flex md:flex-col-reverse" : "flex",
      )}>
      {#if $room?.meta?.isPrivate() && $membershipStatus !== MembershipStatus.Granted}
        <div class="py-20">
          <div class="card flex flex-col gap-8 m-auto max-w-md items-center text-center">
            <p class="opacity-75">You aren't currently a member of this room.</p>
            {#if $membershipStatus === MembershipStatus.Pending}
              <Button class="button button-neutral button-sm" disabled={leaving} onclick={leave}>
                <Icon icon={ClockCircle} />
                Access Pending
              </Button>
            {:else}
              <Button class="button button-neutral button-sm" disabled={joining} onclick={join}>
                {#if joining}
                  <Spinner size="sm" />
                {:else}
                  <Icon icon={Login2} />
                {/if}
                Join Room
              </Button>
            {/if}
          </div>
        </div>
      {:else}
        {#if loadingForward && elements.length > 0}
          <p class="py-20 flex justify-center">
            <Spinner loading={loadingForward}>Looking for messages...</Spinner>
          </p>
        {/if}
        {#each elements as { type, id, value, showPubkey } (id)}
          {#if type === "new-messages"}
            <div
              {id}
              class={cx("flex items-center py-2 text-xs transition-colors", {
                "opacity-0": showFixedNewMessages,
              })}>
              <div class="h-px grow bg-primary text-primary-content"></div>
              <p
                class="rounded-full bg-primary text-primary-content px-2 py-1"
                style="color: var(--primary-content)">
                New Messages
              </p>
              <div class="h-px grow bg-primary text-primary-content"></div>
            </div>
          {:else if type === "date"}
            <Divider>{value}</Divider>
          {:else}
            {@const event = value as TrustedEvent}
            {#if event.kind === addMemberKind}
              <RoomItemAddMember {url} {event} />
            {:else}
              <RoomItem
                {url}
                {event}
                {replyTo}
                {showPubkey}
                canEdit={canEditEvent}
                onEdit={onEditEvent} />
            {/if}
          {/if}
        {/each}
        <p class="flex h-10 items-center justify-center py-20">
          {#if loadingBackward}
            <Spinner loading={loadingBackward}>Looking for messages...</Spinner>
          {:else}
            <Spinner>End of message history</Spinner>
          {/if}
        </p>
      {/if}
      <div class="h-screen"></div>
    </div>

    <div
      class={cx(
        "room__compose flex flex-row items-center gap-1 px-2",
        showMobileVideoPanel && "max-md:hidden",
        // the connected bar (mic/camera/screenshare/settings/chat/leave) is too wide
        // to sit beside the compose input on any screen size — give it its own row.
        // gap-2 only applies here (the inline row stays flush with no gap).
        voiceConnectedHere && "flex-col items-stretch gap-2",
      )}>
      <div class="room__compose-inner min-w-0 flex-1">
        {#if $room?.meta?.isPrivate() && $membershipStatus !== MembershipStatus.Granted}
          <!-- pass -->
        {:else if $room?.meta?.isRestricted() && $membershipStatus !== MembershipStatus.Granted}
          <div class="card m-4 flex flex-row items-center justify-between px-4 py-3">
            <p class="opacity-75">Only members are allowed to post to this room.</p>
            {#if $membershipStatus === MembershipStatus.Pending}
              <Button class="button button-neutral button-sm" disabled={leaving} onclick={leave}>
                <Icon icon={ClockCircle} />
                Access Pending
              </Button>
            {:else}
              <Button class="button button-neutral button-sm" disabled={joining} onclick={join}>
                {#if joining}
                  <Spinner size="sm" />
                {:else}
                  <Icon icon={Login2} />
                {/if}
                Ask to Join
              </Button>
            {/if}
          </div>
        {:else}
          <div>
            {#if parent}
              <RoomComposeParent {url} event={parent} clear={clearParent} verb="Replying to" />
            {/if}
            {#if sharedEvent}
              <RoomComposeParent {url} event={sharedEvent} clear={clearShare} verb="Sharing" />
            {/if}
            {#if eventToEdit}
              <RoomComposeEdit clear={clearEventToEdit} />
            {/if}
          </div>
          {#key initialValues}
            <RoomCompose
              {url}
              {h}
              {onSubmit}
              {onEscape}
              {onEditPrevious}
              {initialValues}
              bind:this={compose} />
          {/key}
        {/if}
      </div>
      {#if h}
        <div class="hide-on-keyboard flex flex-shrink-0 items-center justify-center py-2">
          <CallControlBar {url} {h} hideConnectedOnDesktop />
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showScrollButton}
  <div in:fade class="chat__scroll-down">
    <Button class="button button-neutral button-circle" onclick={scrollToBottom}>
      <Icon icon={AltArrowDown} />
    </Button>
  </div>
{/if}

{#if showFixedNewMessages}
  <div class="relative z-popover flex justify-center">
    <div transition:fly={{duration: 200}} class="fixed top-12 pt-sai">
      <Button class="button button-primary button-xs button-pill" onclick={scrollToNewMessages}>
        New Messages
      </Button>
    </div>
  </div>
{/if}
