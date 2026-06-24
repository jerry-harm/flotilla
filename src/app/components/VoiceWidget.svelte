<script lang="ts">
  import {readable} from "svelte/store"
  import {fade, fly} from "svelte/transition"
  import {goto} from "$app/navigation"
  import {page} from "$app/stores"
  import cx from "classnames"
  import {displayRelayUrl} from "@welshman/util"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import VideocameraOff from "@assets/icons/videocamera-off.svg?dataurl"
  import VideocameraRecord from "@assets/icons/videocamera-record.svg?dataurl"
  import Monitor from "@assets/icons/monitor.svg?dataurl"
  import PhoneRounded from "@assets/icons/phone-rounded.svg?dataurl"
  import PhoneCallingRounded from "@assets/icons/phone-calling-rounded.svg?dataurl"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Settings from "@assets/icons/settings.svg?dataurl"
  import {Capacitor} from "@capacitor/core"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import VoiceCallAudioSettingsDialog from "@app/components/VoiceCallAudioSettingsDialog.svelte"
  import VoiceRoomJoinDialog from "@app/components/VoiceRoomJoinDialog.svelte"
  import {decodeRelay} from "@app/relays"
  import {deriveRoom, displayRoom, getRoomType, RoomType} from "@app/groups"
  import type {Room} from "@app/groups"
  import {pushModal} from "@app/modal"
  import {notifications} from "@app/notifications"
  import {makeRoomPath} from "@app/routes"
  import {
    VideoCallLayout,
    isDesktopLayout,
    toggleCamera,
    toggleScreenShare,
    videoCallLayout,
    CallState,
    currentCallSession,
    callTargetRoom,
    callMicMuted,
    callState,
    cancelJoinVoiceRoom,
    leaveVoiceRoom,
    toggleMute,
  } from "@app/call"

  const {relay, h} = $derived($page.params)
  const url = $derived(relay ? decodeRelay(relay) : undefined)
  const displayedRoomStore = $derived(
    url && h && typeof h === "string" ? deriveRoom(url, h) : readable(undefined),
  )
  const routeDisplayedRoom = $derived($displayedRoomStore)

  const isViewingCurrentVoiceRoom = $derived(
    $callTargetRoom !== undefined &&
      url !== undefined &&
      typeof h === "string" &&
      $callTargetRoom.url === url &&
      $callTargetRoom.h === h,
  )

  const targetRoom = $derived.by((): Room | undefined => {
    if ($callState === CallState.Joining || $callState === CallState.Connected) {
      return $callTargetRoom
    }
    if ($callState === CallState.Disconnected) {
      if (routeDisplayedRoom) {
        if (getRoomType(routeDisplayedRoom) === RoomType.Voice) {
          return routeDisplayedRoom
        }
        return undefined
      }
      return $callTargetRoom
    }
    return $callTargetRoom
  })

  const roomName = $derived(targetRoom ? displayRoom(targetRoom.url, targetRoom.h) : "")
  const spaceName = $derived(targetRoom ? displayRelayUrl(targetRoom.url) : "")

  const openJoinDialog = async () => {
    if (!targetRoom) return
    await goto(makeRoomPath(targetRoom.url, targetRoom.h))
    pushModal(VoiceRoomJoinDialog, {url: targetRoom.url, h: targetRoom.h})
  }

  const goToRoom = () => {
    if (!targetRoom) return
    const path = makeRoomPath(targetRoom.url, targetRoom.h)
    if ($page.url.pathname !== path) {
      void goto(path)
    }
  }

  const openCallSettings = () => {
    pushModal(VoiceCallAudioSettingsDialog)
  }

  const showChatButton = $derived($callState === CallState.Connected && isViewingCurrentVoiceRoom)

  const isChatPanelActive = $derived(
    showChatButton &&
      (isDesktopLayout.current
        ? $videoCallLayout === VideoCallLayout.Split
        : $videoCallLayout === VideoCallLayout.Chat),
  )

  const onChatToggle = () => {
    if (!showChatButton) return
    if (isDesktopLayout.current) {
      videoCallLayout.update(p =>
        p === VideoCallLayout.Split ? VideoCallLayout.Video : VideoCallLayout.Split,
      )
    } else {
      videoCallLayout.update(p =>
        p === VideoCallLayout.Video ? VideoCallLayout.Chat : VideoCallLayout.Video,
      )
    }
  }

  const chatUnread = $derived(
    targetRoom !== undefined && $notifications.has(makeRoomPath(targetRoom.url, targetRoom.h)),
  )
</script>

{#if targetRoom}
  <div
    in:fly={{y: 60, duration: 350}}
    out:fly={{y: 60, duration: 250}}
    class="card card-sm flex flex-col gap-2">
    <div class="flex items-start justify-between gap-2">
      <Button
        class="min-w-0 flex-1 rounded-xl px-2 py-1 text-left hover:bg-surface"
        onclick={goToRoom}
        aria-label="Open room {roomName}">
        <div class="flex flex-col gap-0.5">
          {#if $callState === CallState.Joining}
            <span class="text-sm font-semibold text-warning">Joining...</span>
          {:else if $callState === CallState.Connected}
            <span class="text-sm font-semibold text-success">Voice Connected</span>
          {:else}
            <span class="text-sm font-semibold text-muted">Disconnected</span>
          {/if}
          <span class="ellipsize text-xs text-muted">
            {roomName} / {spaceName}
          </span>
        </div>
      </Button>
      {#if showChatButton}
        <Button
          data-tip="Toggle Chat"
          class={cx(
            "button button-sm button-square tip tip-top relative",
            isChatPanelActive && "button-primary",
          )}
          onclick={onChatToggle}>
          <Icon icon={ChatRound} size={4} />
          {#if chatUnread}
            <span
              transition:fade={{duration: 150}}
              class="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary"
              aria-hidden="true"></span>
          {/if}
        </Button>
      {/if}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      {#if $callState === CallState.Joining}
        <Spinner size="sm" />
        <Button
          data-tip="Cancel"
          class="button button-sm button-square tip tip-top"
          onclick={cancelJoinVoiceRoom}>
          <Icon icon={CloseCircle} size={4} />
        </Button>
      {:else if $callState === CallState.Connected && $currentCallSession}
        <Button
          data-tip={$callMicMuted ? "Unmute" : "Mute"}
          class={cx(
            "button button-sm button-square tip tip-top",
            $callMicMuted ? "button-error" : "button-neutral",
          )}
          onclick={toggleMute}>
          <span class="relative inline-flex">
            <Icon icon={Microphone} size={4} />
            {#if $callMicMuted}
              <span
                class="absolute left-1/2 top-1/2 h-0.5 w-6 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current"
                aria-hidden="true"></span>
            {/if}
          </span>
        </Button>
        <Button
          data-tip={$currentCallSession.cameraOn ? "Turn off camera" : "Turn on camera"}
          class={cx(
            "button button-sm button-square tip tip-top",
            $currentCallSession.cameraOn ? "button-primary" : "button-error",
          )}
          onclick={toggleCamera}>
          <Icon icon={$currentCallSession.cameraOn ? VideocameraRecord : VideocameraOff} size={4} />
        </Button>
        {#if !Capacitor.isNativePlatform()}
          <Button
            data-tip={$currentCallSession.screenShareOn ? "Stop sharing" : "Share screen"}
            class={cx(
              "button button-sm button-square tip tip-top",
              $currentCallSession.screenShareOn ? "button-primary" : "button-neutral",
            )}
            onclick={toggleScreenShare}>
            <Icon icon={Monitor} size={4} />
          </Button>
        {/if}
        <Button
          data-tip="Call settings"
          class="button button-neutral button-sm button-square tip tip-top"
          onclick={openCallSettings}>
          <Icon icon={Settings} size={4} />
        </Button>
        <Button
          data-tip="Leave room"
          class="button button-error button-sm button-square tip tip-top"
          onclick={leaveVoiceRoom}>
          <Icon icon={PhoneRounded} size={4} />
        </Button>
      {:else}
        <Button
          data-tip="Join Voice"
          class="button button-primary button-sm button-square tip tip-top"
          onclick={openJoinDialog}>
          <Icon icon={PhoneCallingRounded} size={4} />
        </Button>
      {/if}
    </div>
  </div>
{/if}
