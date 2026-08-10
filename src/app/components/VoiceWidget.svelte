<script lang="ts">
  import {readable} from "svelte/store"
  import {fade, fly} from "svelte/transition"
  import {goto} from "$app/navigation"
  import {page} from "$app/stores"
  import cx from "classnames"
  import {Capacitor} from "@capacitor/core"
  import {displayRelayUrl} from "@welshman/util"
  import type {Room} from "@welshman/app"
  import Microphone from "@assets/icons/microphone.svg?dataurl"
  import MicrophoneOff from "@assets/icons/microphone-off.svg?dataurl"
  import VideocameraOff from "@assets/icons/videocamera-off.svg?dataurl"
  import VideocameraRecord from "@assets/icons/videocamera-record.svg?dataurl"
  import Monitor from "@assets/icons/monitor.svg?dataurl"
  import EndCall from "@assets/icons/end-call-rounded.svg?dataurl"
  import PhoneCallingRounded from "@assets/icons/phone-calling-rounded.svg?dataurl"
  import ChatRound from "@assets/icons/chat-round.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Settings from "@assets/icons/settings.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import VoiceCallAudioSettingsDialog from "@app/components/VoiceCallAudioSettingsDialog.svelte"
  import VoiceRoomJoinDialog from "@app/components/VoiceRoomJoinDialog.svelte"
  import {rooms} from "@app/core"
  import {decodeRelay} from "@app/relays"
  import {RoomType, displayRoom, getRoomType} from "@app/rooms"
  import {pushModal} from "@app/modal"
  import {notifications} from "@app/notifications"
  import {makeRoomPath} from "@app/routes"
  import {
    VideoCallLayout,
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
    url && h && typeof h === "string" ? $rooms.forRoom(url, h) : readable(undefined),
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

  const isChatPanelActive = $derived(showChatButton && $videoCallLayout === VideoCallLayout.Split)

  const onChatToggle = () => {
    if (!showChatButton) return
    videoCallLayout.update(p =>
      p === VideoCallLayout.Split ? VideoCallLayout.Video : VideoCallLayout.Split,
    )
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
    <Button
      class="w-full min-w-0 rounded-xl px-2 py-1 text-left hover:bg-surface"
      onclick={goToRoom}
      aria-label="Open room {roomName}">
      <div class="flex flex-col gap-0.5">
        {#if $callState === CallState.Joining}
          <span class="text-sm font-semibold text-warning">Joining...</span>
        {:else if $callState === CallState.Connected}
          <span class="text-sm font-semibold text-success">Voice Connected</span>
        {:else}
          <span class="text-sm font-semibold text-content-muted">Disconnected</span>
        {/if}
        <span class="truncate min-w-0 text-xs text-content-muted">
          {roomName} / {spaceName}
        </span>
      </div>
    </Button>
    <div class="grid grid-cols-3 gap-1.5">
      {#if $callState === CallState.Joining}
        <Button
          aria-label="Cancel joining voice room"
          class="button button-neutral col-span-3 flex-col !h-auto gap-0.5 rounded-xl px-2 py-1.5"
          onclick={cancelJoinVoiceRoom}>
          <Icon icon={CloseCircle} size={4} />
          <span class="text-[10px] leading-none font-semibold">Cancel</span>
        </Button>
      {:else if $callState === CallState.Connected && $currentCallSession}
        <Button
          aria-label={$callMicMuted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={!$callMicMuted}
          class={cx(
            "button w-full flex-col !h-auto gap-0.5 rounded-xl px-2 py-1.5",
            $callMicMuted ? "button-neutral" : "button-primary",
          )}
          onclick={toggleMute}>
          <Icon icon={$callMicMuted ? MicrophoneOff : Microphone} size={$callMicMuted ? 4 : 4.5} />
          <span class="text-[10px] leading-none font-semibold">
            {$callMicMuted ? "Unmute" : "Mute"}
          </span>
        </Button>
        <Button
          aria-label={$currentCallSession.cameraOn ? "Turn off camera" : "Turn on camera"}
          aria-pressed={$currentCallSession.cameraOn}
          class={cx(
            "button w-full flex-col !h-auto gap-0.5 rounded-xl px-2 py-1.5",
            $currentCallSession.cameraOn ? "button-primary" : "button-neutral",
          )}
          onclick={toggleCamera}>
          <Icon icon={$currentCallSession.cameraOn ? VideocameraRecord : VideocameraOff} size={4} />
          <span class="text-[10px] leading-none font-semibold">
            {$currentCallSession.cameraOn ? "Stop" : "Start"}
          </span>
        </Button>
        {#if !Capacitor.isNativePlatform()}
          <Button
            aria-label={$currentCallSession.screenShareOn ? "Stop sharing screen" : "Share screen"}
            aria-pressed={$currentCallSession.screenShareOn}
            class={cx(
              "button w-full flex-col !h-auto gap-0.5 rounded-xl px-2 py-1.5",
              $currentCallSession.screenShareOn ? "button-primary" : "button-neutral",
            )}
            onclick={toggleScreenShare}>
            <Icon icon={Monitor} size={3.75} />
            <span class="text-[10px] leading-none font-semibold">
              {$currentCallSession.screenShareOn ? "Stop share" : "Share"}
            </span>
          </Button>
        {/if}
        <Button
          aria-label="Call settings"
          class="button button-neutral w-full flex-col !h-auto gap-0.5 rounded-xl px-2 py-1.5"
          onclick={openCallSettings}>
          <Icon icon={Settings} size={4} />
          <span class="text-[10px] leading-none font-semibold">Settings</span>
        </Button>
        <Button
          aria-label="Leave voice room"
          class="button button-error w-full flex-col !h-auto gap-0.5 rounded-xl px-2 py-1.5"
          onclick={leaveVoiceRoom}>
          <Icon icon={EndCall} size={4.5} />
          <span class="text-[10px] leading-none font-semibold">Leave</span>
        </Button>
        {#if showChatButton}
          <Button
            aria-label="Toggle chat panel"
            aria-pressed={isChatPanelActive}
            class={cx(
              "button w-full flex-col !h-auto gap-0.5 rounded-xl px-2 py-1.5 relative",
              isChatPanelActive ? "button-primary" : "button-neutral",
            )}
            onclick={onChatToggle}>
            <Icon icon={ChatRound} size={4} />
            <span class="text-[10px] leading-none font-semibold">Chat</span>
            {#if chatUnread}
              <span
                transition:fade={{duration: 150}}
                class="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-primary"
                aria-hidden="true"></span>
            {/if}
          </Button>
        {/if}
      {:else}
        <Button
          aria-label="Join voice room"
          class="button button-primary col-span-3 flex-col !h-auto gap-0.5 rounded-xl px-2 py-1.5"
          onclick={openJoinDialog}>
          <Icon icon={PhoneCallingRounded} size={4.5} />
          <span class="text-[10px] leading-none font-semibold">Join</span>
        </Button>
      {/if}
    </div>
  </div>
{/if}
