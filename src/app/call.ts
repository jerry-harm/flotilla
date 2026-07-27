/**
 * Voice rooms via LiveKit. Note: Voice does not work on localhost in Firefox
 * (ICE candidate gathering fails). Use Chrome or test from deployed HTTPS.
 */
import {MediaQuery} from "svelte/reactivity"
import {
  DisconnectReason,
  LocalParticipant,
  LocalTrackPublication,
  Participant,
  Room as LiveKitRoom,
  RoomEvent,
  Track,
  TrackPublication,
  supportsAudioOutputSelection,
  type AudioCaptureOptions,
} from "livekit-client"
import {derived, get, writable} from "svelte/store"
import {map, not, nthEq, reject, removeUndefined, uniqBy} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {makeHttpAuth, makeHttpAuthHeader, getTags} from "@welshman/util"
import {signer} from "@welshman/app"
import {load} from "@welshman/net"
import {getLivekitEndpoint} from "$lib/livekit"
import {AbortError, TimeoutError, whenAborted, whenTimeout} from "$lib/util"
import {deriveLatestEventForUrl} from "@app/repository"
import {deriveRoom, makeRoomId, type Room} from "@app/groups"
import {pushToast} from "@app/toast"

export const LIVEKIT_PARTICIPANTS = 39004

export {supportsAudioOutputSelection}

const LIVEKIT_DEFAULT_DEVICE_ID = "default"
const VISUAL_SOURCES = [Track.Source.Camera, Track.Source.ScreenShare] as const
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]

export type CallSession = {
  url: string
  h: string
  livekit: LiveKitRoom
  cameraOn: boolean
  screenShareOn: boolean
}

/** Mic mute state is separate so toggling it does not re-render video tiles. */
export const callMicMuted = writable(true)

export type CallParticipant = {pubkey?: string; liveKitIdentity: string}

export type ParticipantMediaState = {
  muted: boolean
  cameraOn: boolean
}

export enum CallState {
  Joining = "joining",
  Connected = "connected",
  Disconnected = "disconnected",
}

export enum VideoCallLayout {
  Chat = "chat",
  Video = "video",
  Split = "split",
}

export enum ViewportSize {
  Desktop = "desktop",
  Mobile = "mobile",
}

export enum DeviceKind {
  AudioInput = "audioinput",
  AudioOutput = "audiooutput",
  VideoInput = "videoinput",
}

export const currentCallSession = writable<CallSession | undefined>(undefined)

export const callState = writable<CallState>(CallState.Disconnected)

export const callTargetRoom = writable<Room | undefined>(undefined)

export const speakingParticipants = writable<CallParticipant[]>([])

export const participantMediaState = writable(new Map<string, ParticipantMediaState>())

export const mediaStateByIdentity = derived(
  [participantMediaState, currentCallSession, callMicMuted],
  ([$media, $session, $micMuted]) =>
    (liveKitIdentity: string) => {
      if ($session?.livekit.localParticipant.identity === liveKitIdentity) {
        return {muted: $micMuted, cameraOn: $session.cameraOn}
      }
      return $media.get(liveKitIdentity) ?? {muted: true, cameraOn: false}
    },
)

export const isParticipantSpeaking = derived(
  speakingParticipants,
  $participants => (p: CallParticipant) =>
    $participants.some(sp => participantKey(sp) === participantKey(p)),
)

export const videoTrackRevision = writable(0)

export const triggerVideoTrackRevision = () => {
  videoTrackRevision.update(n => n + 1)
}

export const isDesktopLayout = new MediaQuery("min-width: 768px", false)

export const videoCallViewportSync = {
  previousLayout: undefined as ViewportSize | undefined,
}

export const videoCallLayout = writable<VideoCallLayout>(VideoCallLayout.Split)

export const videoPrimaryTileKey = writable<string | undefined>(undefined)

export const videoTileCount = derived(
  [currentCallSession, callState, videoTrackRevision, participantMediaState],
  ([$session, $state]) => {
    if ($state !== CallState.Connected || !$session) return 0
    return countLiveVisualFeeds($session)
  },
)

export const joinVoiceRoom = async (
  url: string,
  h: string,
  startMuted = true,
  preferredMicId?: string,
): Promise<void> => {
  abortJoinVoiceRoom()

  callTargetRoom.set(get(deriveRoom(url, h)))
  callState.set(CallState.Joining)

  const controller = new AbortController()
  joinAbortController = controller
  const signal = controller.signal
  const isActive = () => joinAbortController === controller

  // Self-cleaning controller: aborted in finally so whenTimeout/whenAborted
  // helpers clear their timers/listeners once the races below have settled.
  const settle = new AbortController()

  try {
    // Tear down any existing session before joining. Bound it so a slow leave
    // (camera/screenshare renegotiation can take ~15s) cannot block this join.
    if (get(currentCallSession)) {
      await Promise.race([
        leaveVoiceRoom(),
        whenTimeout(15_000, {message: "Leaving previous call timed out.", signal: settle.signal}),
        whenAborted(signal),
      ]).catch(e => {
        if (e instanceof AbortError) throw e
      })

      // leaveVoiceRoom flips callState to Disconnected; re-assert Joining.
      callState.set(CallState.Joining)
    }

    if (signal.aborted) throw new AbortError()

    const {server_url, participant_token} = await Promise.race([
      fetchLivekitToken(url, h, signal),
      whenTimeout(15_000, {
        message: "Connection timed out. Please check your network and try again.",
        signal: settle.signal,
      }),
      whenAborted(signal),
    ])

    if (signal.aborted) throw new AbortError()

    const liveKitRoom = new LiveKitRoom({adaptiveStream: true, dynacast: true})
    activeRoom = liveKitRoom

    liveKitRoom.on(RoomEvent.Disconnected, makeOnRoomDisconnected(liveKitRoom))
    liveKitRoom.on(RoomEvent.Reconnected, makeOnRoomReconnected(liveKitRoom))
    liveKitRoom.on(RoomEvent.ParticipantConnected, onParticipantConnected)
    liveKitRoom.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
    liveKitRoom.on(RoomEvent.TrackSubscribed, onTrackSubscribed)
    liveKitRoom.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
    liveKitRoom.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished)
    liveKitRoom.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
    liveKitRoom.on(RoomEvent.TrackMuted, onParticipantMediaChanged)
    liveKitRoom.on(RoomEvent.TrackUnmuted, onParticipantMediaChanged)
    liveKitRoom.on(RoomEvent.TrackPublished, onParticipantMediaChanged)
    liveKitRoom.on(RoomEvent.TrackUnpublished, onParticipantMediaChanged)
    liveKitRoom.on(RoomEvent.LocalTrackPublished, onParticipantMediaChanged)

    try {
      await Promise.race([
        liveKitRoom.connect(server_url, participant_token, {maxRetries: 0}),
        whenTimeout(15_000, {
          message: "Connection timed out. Please check your network and try again.",
          signal: settle.signal,
        }),
        whenAborted(signal),
      ])
    } catch (e) {
      teardownRoom(liveKitRoom)
      throw e
    }

    participantMediaState.set(new Map())
    syncParticipantMedia(liveKitRoom.localParticipant)
    for (const p of liveKitRoom.remoteParticipants.values()) {
      syncParticipantMedia(p)
    }

    // Bounded against timeout/abort inside setUpMicrophone: a stuck permission
    // prompt resolves to muted rather than hanging the join forever.
    const muted = await setUpMicrophone(
      startMuted,
      preferredMicId,
      liveKitRoom.localParticipant,
      signal,
      settle.signal,
    )

    // A cancel during the mic step must tear down the connected room rather
    // than leaking it.
    if (signal.aborted) {
      teardownRoom(liveKitRoom)
      throw new AbortError()
    }

    callMicMuted.set(muted)
    currentCallSession.set({
      url,
      h,
      livekit: liveKitRoom,
      cameraOn: false,
      screenShareOn: false,
    })
    callState.set(CallState.Connected)
    clearReconnectSchedule()
    playJoinSound()
  } catch (e) {
    if (isActive()) callState.set(CallState.Disconnected)
    if (e instanceof AbortError) {
      clearReconnectSchedule()
      return
    }
    throw e
  } finally {
    settle.abort()
    if (isActive()) joinAbortController = undefined
  }
}

export const leaveVoiceRoom = async () => {
  clearReconnectSchedule()
  const session = get(currentCallSession)
  if (!session) return

  const audio = new Audio("/leave-voice-room.mp3")
  audio.play().catch(() => {})

  if (session.cameraOn) {
    try {
      await session.livekit.localParticipant.setCameraEnabled(false)
    } catch {
      pushToast({theme: "error", message: "Error turning off camera."})
    }
  }

  if (session.screenShareOn) {
    try {
      await session.livekit.localParticipant.setScreenShareEnabled(false)
    } catch {
      pushToast({theme: "error", message: "Error turning off screen sharing."})
    }
  }

  // Always tear down this room's connection and listeners.
  teardownRoom(session.livekit)

  // Only reset shared UI state if this session is still current. A slow leave
  // that was superseded by a new join (bounded by a timeout in joinVoiceRoom)
  // must not clobber the freshly-joined session when it finally completes.
  if (get(currentCallSession) === session) {
    callState.set(CallState.Disconnected)
    callMicMuted.set(true)
    currentCallSession.set(undefined)
    speakingParticipants.set([])
    participantMediaState.set(new Map())
  }
}

export const cancelJoinVoiceRoom = () => {
  clearReconnectSchedule()
  abortJoinVoiceRoom()
}

export const toggleMute = async () => {
  const session = get(currentCallSession)
  if (!session) return

  callMicMuted.update(not)

  const muted = get(callMicMuted)
  try {
    await session.livekit.localParticipant.setMicrophoneEnabled(!muted)
  } catch {
    callMicMuted.set(!muted)
    pushToast({
      theme: "error",
      message: muted ? "Could not mute microphone" : "Could not access microphone",
    })
  }
}

export const toggleCamera = async () => {
  const session = get(currentCallSession)
  if (!session) return

  const cameraOn = !session.cameraOn
  try {
    await session.livekit.localParticipant.setCameraEnabled(cameraOn)
    currentCallSession.update(s => s && {...s, cameraOn})
  } catch {
    pushToast({
      theme: "error",
      message: cameraOn ? "Could not access camera" : "Could not turn off camera",
    })
  }
}

export const toggleScreenShare = async () => {
  const session = get(currentCallSession)
  if (!session) return

  const screenShareOn = !session.screenShareOn
  try {
    await session.livekit.localParticipant.setScreenShareEnabled(screenShareOn)
    currentCallSession.update(s => s && {...s, screenShareOn})
  } catch {
    pushToast({
      theme: "error",
      message: screenShareOn ? "Could not start screen sharing" : "Could not stop screen sharing",
    })
  }
}

export const switchCallActiveDevice = async (
  kind: DeviceKind,
  targetDeviceId: string,
): Promise<void> => {
  const session = get(currentCallSession)
  if (!session) return
  const id = targetDeviceId === "" ? LIVEKIT_DEFAULT_DEVICE_ID : targetDeviceId
  try {
    await session.livekit.switchActiveDevice(kind, id)
  } catch {
    let label: string
    switch (kind) {
      case DeviceKind.AudioInput:
        label = "microphone"
        break
      case DeviceKind.AudioOutput:
        label = "speaker"
        break
      case DeviceKind.VideoInput:
        label = "camera"
        break
    }
    pushToast({theme: "error", message: `Error changing ${label}`})
  }
}

export const resetVideoCallLayout = () => {
  videoCallViewportSync.previousLayout = undefined
  videoCallLayout.set(VideoCallLayout.Chat)
}

export const toggleVideoPrimaryTile = (key: string) => {
  videoPrimaryTileKey.update(k => (k === key ? undefined : key))
}

export const loadCallParticipants = (url: string, h: string) =>
  load({
    relays: [url],
    filters: [{kinds: [LIVEKIT_PARTICIPANTS], "#d": [h]}],
  })

export const deriveCallParticipants = (url: string, h: string) =>
  // We use the livekit identity list while in a call, and fall back to the list in kind 39004.
  derived(
    [
      participantMediaState,
      callTargetRoom,
      deriveLatestEventForUrl(url, [{kinds: [LIVEKIT_PARTICIPANTS], "#d": [h]}]),
    ],
    ([$participantMediaState, $callTargetRoom, $publishedParticipantList]) => {
      const inCall = $participantMediaState.size > 0 && $callTargetRoom?.id === makeRoomId(url, h)

      if (inCall) {
        const participants = [...$participantMediaState.keys()].map(participantFromLiveKitIdentity)
        return uniqBy((p: CallParticipant) => participantKey(p), participants)
      } else {
        const latestEvent = $publishedParticipantList as TrustedEvent | undefined
        if (!latestEvent) return []
        const participants = removeUndefined(
          map(
            (tag: string[]) => (tag[1] ? participantFromLiveKitIdentity(tag[1]) : undefined),
            getTags("participant", latestEvent.tags),
          ),
        )
        return uniqBy((p: CallParticipant) => participantKey(p), participants)
      }
    },
  )

export const pubkeyFromLiveKitIdentity = (liveKitIdentity: string): string | undefined =>
  /^[a-f0-9]{64}$/.test(liveKitIdentity.slice(0, 64)) ? liveKitIdentity.slice(0, 64) : undefined

export const participantFromLiveKitIdentity = (liveKitIdentity: string): CallParticipant => {
  const pk = pubkeyFromLiveKitIdentity(liveKitIdentity)
  return pk ? {pubkey: pk, liveKitIdentity} : {liveKitIdentity}
}

export const participantKey = (p: CallParticipant) => p.pubkey ?? p.liveKitIdentity

// The room whose events are allowed to mutate shared state. Abandoned rooms
// (after switching calls or an engine reconnect give-up) must not clobber it.
let activeRoom: LiveKitRoom | undefined
let reconnectTimeout: ReturnType<typeof setTimeout> | undefined
let reconnectAttempt = 0
let joinAbortController: AbortController | undefined
let hadCallSession = false

currentCallSession.subscribe(session => {
  if (session) {
    hadCallSession = true
    return
  }
  if (!hadCallSession) return
  hadCallSession = false
  videoPrimaryTileKey.set(undefined)
  resetVideoCallLayout()
})

const teardownRoom = (livekit: LiveKitRoom) => {
  if (activeRoom === livekit) activeRoom = undefined

  // Dropping the listeners keeps TrackUnsubscribed from removing the hidden
  // audio elements onTrackSubscribed appended, so detach them here instead.
  for (const participant of livekit.remoteParticipants.values()) {
    for (const publication of participant.audioTrackPublications.values()) {
      publication.track?.detach().forEach(el => el.remove())
    }
  }

  livekit.removeAllListeners()
  livekit.disconnect()
}

const countLiveVisualFeeds = (session: CallSession): number => {
  const livekit = session.livekit
  let n = 0
  const lp = livekit.localParticipant
  if (session.cameraOn) {
    const pub = lp.getTrackPublication(Track.Source.Camera)
    if (pub?.track) n += 1
  }
  if (session.screenShareOn) {
    const pub = lp.getTrackPublication(Track.Source.ScreenShare)
    if (pub?.track) n += 1
  }
  for (const rp of livekit.remoteParticipants.values()) {
    for (const source of VISUAL_SOURCES) {
      const pub = rp.getTrackPublication(source)
      if (pub?.isSubscribed && pub.track && !pub.isMuted) n += 1
    }
  }
  return n
}

const participantMediaFrom = (participant: Participant): ParticipantMediaState => ({
  muted: !participant.isMicrophoneEnabled,
  cameraOn: participant.isCameraEnabled,
})

const deleteParticipant = (liveKitIdentity: string) => {
  participantMediaState.update(m => new Map(reject(nthEq(0, liveKitIdentity), [...m])))
}

const syncParticipantMedia = (participant: Participant) => {
  const state = participantMediaFrom(participant)
  participantMediaState.update(m => {
    const prev = m.get(participant.identity)
    if (prev?.muted === state.muted && prev?.cameraOn === state.cameraOn) return m
    const next = new Map(m)
    next.set(participant.identity, state)
    return next
  })
}

// LiveKit does not emit ParticipantConnected/Disconnected during reconnect.
const resyncAfterReconnect = (livekit: LiveKitRoom) => {
  if (livekit !== activeRoom) return

  const next = new Map<string, ParticipantMediaState>()
  for (const p of [livekit.localParticipant, ...livekit.remoteParticipants.values()]) {
    next.set(p.identity, participantMediaFrom(p))
  }
  participantMediaState.set(next)

  const session = get(currentCallSession)
  if (!session) return

  const {localParticipant} = livekit
  callMicMuted.set(!localParticipant.isMicrophoneEnabled)
  currentCallSession.set({
    ...session,
    cameraOn: localParticipant.isCameraEnabled,
    screenShareOn: localParticipant.isScreenShareEnabled,
  })
  triggerVideoTrackRevision()
}

const fetchLivekitToken = async (
  url: string,
  groupId: string,
  signal?: AbortSignal,
): Promise<{server_url: string; participant_token: string}> => {
  const endpoint = getLivekitEndpoint(url, groupId)

  const $signer = signer.get()
  if (!$signer) throw new Error("No signer available")

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError")

  const template = await makeHttpAuth(endpoint, "GET")
  const signedEvent = await $signer.sign(template)
  const authHeader = makeHttpAuthHeader(signedEvent)

  const response = await fetch(endpoint, {
    headers: {Authorization: authHeader},
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token request failed (${response.status}): ${text}`)
  }

  return response.json()
}

const setUpMicrophone = async (
  startMuted: boolean,
  preferredMicId: string | undefined,
  participant: LocalParticipant,
  signal?: AbortSignal,
  settleSignal?: AbortSignal,
): Promise<boolean> => {
  if (startMuted) {
    return true
  }

  let muted = true
  let capture: AudioCaptureOptions | undefined = undefined
  if (preferredMicId) {
    capture = {deviceId: preferredMicId}
  }
  try {
    await Promise.race([
      participant.setMicrophoneEnabled(true, capture),
      whenTimeout(15_000, {message: "Microphone access timed out.", signal: settleSignal}),
      whenAborted(signal),
    ])
    muted = false
  } catch (e) {
    // Timeout or microphone rejection: join muted, the call is still usable. A
    // genuine abort is surfaced to the caller so it can tear down the room.
    if (e instanceof AbortError) throw e
    if (!(e instanceof TimeoutError)) {
      pushToast({theme: "error", message: "Could not access microphone"})
    }
  }
  return muted
}

const clearReconnectSchedule = () => {
  if (reconnectTimeout !== undefined) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = undefined
  }
  reconnectAttempt = 0
}

const attemptReconnect = async () => {
  const target = get(callTargetRoom)
  if (!target) return

  try {
    await joinVoiceRoom(target.url, target.h)
  } catch {
    if (reconnectAttempt >= RECONNECT_DELAYS.length) {
      pushToast({theme: "error", message: "Voice connection lost."})
      clearReconnectSchedule()
      return
    }
    scheduleReconnect()
  }
}

const scheduleReconnect = () => {
  if (reconnectTimeout !== undefined) return
  if (!get(callTargetRoom)) return
  if (reconnectAttempt >= RECONNECT_DELAYS.length) {
    pushToast({theme: "error", message: "Voice connection lost."})
    return
  }

  const delay = RECONNECT_DELAYS[reconnectAttempt]!
  reconnectAttempt++
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = undefined
    void attemptReconnect()
  }, delay)
}

const makeOnRoomReconnected = (livekit: LiveKitRoom) => () => {
  if (livekit !== activeRoom) return
  resyncAfterReconnect(livekit)
}

const makeOnRoomDisconnected = (livekit: LiveKitRoom) => (reason?: DisconnectReason) => {
  // Ignore disconnects from rooms that are no longer the active session.
  if (livekit !== activeRoom) return

  // Livekit unsubscribes remote tracks before emitting Disconnected, so
  // onTrackUnsubscribed has already removed their audio elements by now.
  activeRoom = undefined
  livekit.removeAllListeners()

  callMicMuted.set(true)
  currentCallSession.set(undefined)
  if (reason !== undefined && reason !== DisconnectReason.CLIENT_INITIATED) {
    callState.set(CallState.Disconnected)
    if (reason === DisconnectReason.JOIN_FAILURE) {
      pushToast({theme: "error", message: "Could not connect to voice room. Please try again."})
    } else if (get(callTargetRoom)) {
      clearReconnectSchedule()
      scheduleReconnect()
    } else {
      pushToast({theme: "error", message: "Voice connection lost."})
    }
  }
  speakingParticipants.set([])
  participantMediaState.set(new Map())
}

const onParticipantMediaChanged = (_publication: TrackPublication, participant: Participant) => {
  syncParticipantMedia(participant)
}

const onTrackSubscribed = (track: Track) => {
  if (track.kind === Track.Kind.Audio) {
    const element = track.attach()
    element.style.display = "none"
    document.body.appendChild(element)
    element.play().catch(() => {})
  } else if (track.kind === Track.Kind.Video) {
    triggerVideoTrackRevision()
  }
}

const onTrackUnsubscribed = (track: Track) => {
  track.detach().forEach(el => el.remove())
  if (track.kind === Track.Kind.Video) {
    triggerVideoTrackRevision()
  }
}

const onActiveSpeakersChanged = (participants: {identity: string}[]) => {
  speakingParticipants.set(participants.map(p => participantFromLiveKitIdentity(p.identity)))
}

const playJoinSound = () => {
  const audio = new Audio("/join-voice-room.mp3")
  audio.play().catch(() => {})
}

const onParticipantConnected = (participant: Participant) => {
  syncParticipantMedia(participant)
  playJoinSound()
}

const onParticipantDisconnected = (participant: {identity: string}) => {
  deleteParticipant(participant.identity)
}

const onLocalTrackUnpublished = (
  publication: LocalTrackPublication,
  participant: LocalParticipant,
) => {
  if (publication.source !== Track.Source.ScreenShare) return
  const session = get(currentCallSession)
  if (!session || participant.identity !== session.livekit.localParticipant.identity) return
  if (!session.screenShareOn) return
  currentCallSession.set({...session, screenShareOn: false})
}

const abortJoinVoiceRoom = () => {
  joinAbortController?.abort()
}
