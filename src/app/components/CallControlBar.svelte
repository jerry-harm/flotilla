<script lang="ts">
  import {fade} from "svelte/transition"
  import cx from "classnames"
  import {Capacitor} from "@capacitor/core"
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
  import {RoomType, getRoomType} from "@app/rooms"
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

  type Props = {
    url: string
    h: string
    // suppress the full in-call control row on desktop — used where a wider,
    // unobstructed copy of it already floats over the video panel
    hideConnectedOnDesktop?: boolean
  }

  const {url, h, hideConnectedOnDesktop = false}: Props = $props()

  const roomStore = $derived($rooms.forRoom(url, h))
  const room = $derived($roomStore)
  const isVoiceRoom = $derived(room !== undefined && getRoomType(room) === RoomType.Voice)

  const isTargetingThisRoom = $derived(
    $callTargetRoom !== undefined && $callTargetRoom.url === url && $callTargetRoom.h === h,
  )

  const joiningHere = $derived($callState === CallState.Joining && isTargetingThisRoom)
  const connectedHere = $derived($callState === CallState.Connected && isTargetingThisRoom)
  // callTargetRoom isn't cleared on cancel/leave, so it can still point at this room
  // after the call has ended — check actual state, not just "is this the last target".
  const showJoin = $derived(isVoiceRoom && !joiningHere && !connectedHere)

  const openJoinDialog = () => pushModal(VoiceRoomJoinDialog, {url, h})
  const openCallSettings = () => pushModal(VoiceCallAudioSettingsDialog)

  const roomPath = $derived(makeRoomPath(url, h))
  const chatUnread = $derived($notifications.has(roomPath))
  const isChatPanelActive = $derived($videoCallLayout === VideoCallLayout.Split)

  // With chat open, the floating bar shares the video pane with the sidebar rather
  // than spanning the full width — a smaller bar reads as sized for that narrower
  // space instead of just looking unchanged. Sized below mobile's max-md:h-9 (36px)
  // since desktop is mouse-driven, not a touch target. max-md sizing itself is
  // unaffected: mobile chat is a full-screen overlay, not a space-sharing sidebar.
  const compactButtonClass = $derived(
    cx("max-md:h-9 max-md:w-9", isChatPanelActive && "md:h-8 md:w-8"),
  )
  const iconSize = $derived(isChatPanelActive ? 3.5 : 4.5)

  const onChatToggle = () => {
    videoCallLayout.update(p =>
      p === VideoCallLayout.Split ? VideoCallLayout.Video : VideoCallLayout.Split,
    )
  }
</script>

{#if joiningHere || connectedHere || showJoin}
  <!-- every state shares this grid cell so switching between them cross-fades in
       place instead of pushing/jumping past each other as flex siblings, and the
       grid auto-sizes to whichever state is actually present (nothing reserves
       layout space when e.g. the connected bar is display:none on desktop). -->
  <div class="grid items-center justify-center">
    {#if joiningHere}
      <div
        in:fade={{duration: 160}}
        out:fade={{duration: 120}}
        class="pointer-events-auto col-start-1 row-start-1 flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface/95 px-1.5 shadow-xl backdrop-blur-md">
        <span
          data-tip="Joining call…"
          role="status"
          aria-label="Joining call"
          class="spinner spinner-sm mx-1.5 shrink-0"></span>
        <Button
          data-tip="Cancel"
          aria-label="Cancel joining voice room"
          class="button button-circle button-sm button-neutral"
          onclick={cancelJoinVoiceRoom}>
          <Icon icon={CloseCircle} size={4} />
        </Button>
      </div>
    {/if}
    {#if connectedHere}
      <div
        in:fade={{duration: 160}}
        out:fade={{duration: 120}}
        class={cx(
          "pointer-events-auto col-start-1 row-start-1 flex items-center gap-1.5 rounded-full border border-line bg-surface/95 p-1.5 shadow-xl backdrop-blur-md md:gap-2 md:p-2",
          isChatPanelActive && "md:gap-1 md:p-1",
          hideConnectedOnDesktop && "md:hidden",
        )}>
        <Button
          data-tip={$callMicMuted ? "Unmute" : "Mute"}
          aria-label={$callMicMuted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={!$callMicMuted}
          class={cx(
            "button button-circle",
            compactButtonClass,
            $callMicMuted ? "button-neutral" : "button-primary",
          )}
          onclick={toggleMute}>
          <Icon icon={$callMicMuted ? MicrophoneOff : Microphone} size={iconSize} />
        </Button>
        {#if $currentCallSession}
          <Button
            data-tip={$currentCallSession.cameraOn ? "Stop camera" : "Start camera"}
            aria-label={$currentCallSession.cameraOn ? "Turn off camera" : "Turn on camera"}
            aria-pressed={$currentCallSession.cameraOn}
            class={cx(
              "button button-circle",
              compactButtonClass,
              $currentCallSession.cameraOn ? "button-primary" : "button-neutral",
            )}
            onclick={toggleCamera}>
            <Icon
              icon={$currentCallSession.cameraOn ? VideocameraRecord : VideocameraOff}
              size={iconSize} />
          </Button>
          {#if !Capacitor.isNativePlatform()}
            <Button
              data-tip={$currentCallSession.screenShareOn ? "Stop sharing" : "Share screen"}
              aria-label={$currentCallSession.screenShareOn
                ? "Stop sharing screen"
                : "Share screen"}
              aria-pressed={$currentCallSession.screenShareOn}
              class={cx(
                "button button-circle",
                compactButtonClass,
                $currentCallSession.screenShareOn ? "button-primary" : "button-neutral",
              )}
              onclick={toggleScreenShare}>
              <Icon icon={Monitor} size={iconSize} />
            </Button>
          {/if}
        {/if}
        <Button
          data-tip="Call settings"
          aria-label="Call settings"
          class={cx("button button-circle button-neutral", compactButtonClass)}
          onclick={openCallSettings}>
          <Icon icon={Settings} size={iconSize} />
        </Button>
        <Button
          data-tip="Toggle chat"
          aria-label="Toggle chat panel"
          aria-pressed={isChatPanelActive}
          class={cx(
            "button button-circle relative",
            compactButtonClass,
            isChatPanelActive ? "button-primary" : "button-neutral",
          )}
          onclick={onChatToggle}>
          <Icon icon={ChatRound} size={iconSize} />
          {#if chatUnread}
            <span
              class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surface"
              aria-hidden="true"></span>
          {/if}
        </Button>
        <div class="mx-0.5 h-6 w-px shrink-0 bg-line" aria-hidden="true"></div>
        <Button
          data-tip="Leave call"
          aria-label="Leave voice room"
          class={cx("button button-circle button-error", compactButtonClass)}
          onclick={leaveVoiceRoom}>
          <Icon icon={EndCall} size={isChatPanelActive ? 4 : 5} />
        </Button>
      </div>
    {/if}
    {#if showJoin}
      <div
        in:fade={{duration: 160}}
        out:fade={{duration: 120}}
        class="pointer-events-auto col-start-1 row-start-1">
        <Button
          data-tip="Join call"
          aria-label="Join voice room"
          class="button button-primary button-circle shadow-xl"
          onclick={openJoinDialog}>
          <Icon icon={PhoneCallingRounded} size={4.5} />
        </Button>
      </div>
    {/if}
  </div>
{/if}
