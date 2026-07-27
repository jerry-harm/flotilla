import {derived, get, writable, type Readable} from "svelte/store"
import {dissoc, fromPairs, last, poll, randomId, sleep, tryCatch} from "@welshman/lib"
import {AuthStatus, Pool, request, SocketStatus} from "@welshman/net"
import {
  displayRelayUrl,
  getTagValue,
  isRelayUrl,
  makeEvent,
  normalizeRelayUrl,
  RELAY_INVITE,
  RELAY_JOIN,
  RELAY_LEAVE,
  ROOM_JOIN,
} from "@welshman/util"
import {publishThunk, sign, waitForThunkError} from "@welshman/app"
import {stripPrefix} from "@lib/util"
import {PLATFORM_URL} from "@app/env"
import {addSpace, userSpaceUrls} from "@app/groups"
import {relaysMostlyRestricted} from "@app/policies"
import {broadcastUserData} from "@app/profiles"
import {Push} from "@app/push"
import {syncApplicationData} from "@app/sync"
import {notificationSettings, setSpaceNotifications} from "@app/settings"
import {deriveSocket} from "@app/relays"

export const ROOM_CREATE_INVITE = 9009

export type InviteData = {
  url: string
  claim: string
  h?: string
  code?: string
}

export type JoinRequestParams = {
  url: string
  claim: string
}

export const isNetworkAuthError = (error: string) => {
  const lower = error.toLowerCase()

  return lower.includes("failed") || lower.includes("timeout") || lower.includes("network")
}

export const parseInviteLink = (invite: string): InviteData | undefined => {
  if (invite.length < 3 || !invite.includes(".")) {
    return
  }

  return (
    tryCatch(() => {
      const params = fromPairs(Array.from(new URL(invite).searchParams))
      const {r: relay = "", c: claim = "", h = "", code = ""} = params
      const url = normalizeRelayUrl(relay)

      if (isRelayUrl(url)) {
        return {url, claim, h: h || undefined, code: code || undefined}
      }
    }) ||
    tryCatch(() => {
      const url = normalizeRelayUrl(invite)

      if (isRelayUrl(url)) {
        return {url, claim: ""}
      }
    })
  )
}

export const makeInviteLink = (data: InviteData) => {
  const params = new URLSearchParams({
    r: displayRelayUrl(data.url),
    c: data.claim,
  })

  if (data.h) {
    params.set("h", data.h)
  }

  if (data.code) {
    params.set("code", data.code)
  }

  return PLATFORM_URL + "/join?" + params.toString()
}

export const shouldIgnoreError = (error: string) => {
  const isIgnored = error.startsWith("mute: ")
  const isAborted = error.includes("Signing was aborted")
  const isStrictNip29Relay = error.includes("missing group (`h`) tag")

  return isIgnored || isAborted || isStrictNip29Relay
}

export const deriveRelayAuthError = (url: string) =>
  derived([relaysMostlyRestricted, deriveSocket(url)], ([$relaysMostlyRestricted, $socket]) => {
    if ($socket.auth.status === AuthStatus.Forbidden && $socket.auth.details) {
      return stripPrefix($socket.auth.details)
    }

    if ($relaysMostlyRestricted[url]) {
      return stripPrefix($relaysMostlyRestricted[url])
    }
  })

export const makeJoinRequest = (params: JoinRequestParams) =>
  makeEvent(RELAY_JOIN, {tags: [["claim", params.claim]]})

export const publishJoinRequest = (params: JoinRequestParams) =>
  publishThunk({event: makeJoinRequest(params), relays: [params.url]})

export type LeaveRequestParams = {
  url: string
}

export const publishLeaveRequest = (params: LeaveRequestParams) =>
  publishThunk({event: makeEvent(RELAY_LEAVE), relays: [params.url]})

export const publishRoomInvite = async (url: string, h: string) => {
  const code = randomId()
  const error = await waitForThunkError(
    publishThunk({
      event: makeEvent(ROOM_CREATE_INVITE, {
        tags: [
          ["h", h],
          ["code", code],
        ],
      }),
      relays: [url],
    }),
  )

  if (error) {
    return {error, code: undefined}
  }

  return {error: undefined, code}
}

export const publishRoomJoinRequest = (url: string, h: string, code?: string) => {
  const tags = [["h", h]]

  if (code) {
    tags.push(["code", code])
  }

  return publishThunk({
    event: makeEvent(ROOM_JOIN, {tags}),
    relays: [url],
  })
}

const authTerminalStatuses = [
  AuthStatus.None,
  AuthStatus.Ok,
  AuthStatus.Forbidden,
  AuthStatus.DeniedSignature,
]

const waitForAuth = async (socket: ReturnType<ReturnType<typeof Pool.get>["get"]>) => {
  await poll({
    signal: AbortSignal.timeout(10_000),
    condition: () => authTerminalStatuses.includes(socket.auth.status),
  }).catch(() => {})
}

const formatAuthError = (status: AuthStatus, details?: string) => {
  if (status === AuthStatus.DeniedSignature) {
    return "Failed to authenticate — check your signer"
  }

  if (status === AuthStatus.PendingSignature) {
    return "Failed to authenticate — approve the signing request from your extension or signer"
  }

  const message = details || last(status.split(":"))

  return `Failed to authenticate (${message})`
}

export const attemptRelayAccess = async (url: string, claim = "") => {
  const socket = Pool.get().get(url)

  socket.attemptToOpen()

  await poll({
    signal: AbortSignal.timeout(3000),
    condition: () => socket.status === SocketStatus.Open,
  })

  if (socket.status !== SocketStatus.Open) {
    return `Failed to connect`
  }

  await poll({
    signal: AbortSignal.timeout(3000),
    condition: () => socket.auth.status === AuthStatus.Requested,
  })

  for (let i = 0; i < 3 && !authTerminalStatuses.includes(socket.auth.status); i++) {
    await socket.auth.retryAuth(sign)
    await waitForAuth(socket)
  }

  if (![AuthStatus.None, AuthStatus.Ok].includes(socket.auth.status)) {
    return formatAuthError(socket.auth.status, socket.auth.details)
  }

  const error = await waitForThunkError(publishJoinRequest({url, claim}))

  if (shouldIgnoreError(error)) return

  if (claim) {
    if (error.includes("invite code")) {
      return "join request rejected"
    }
  } else if (error.includes("invite code")) {
    return
  }

  return stripPrefix(error)
}

export class Access {
  url: string
  authError: Readable<string | undefined>
  loading = writable(true)
  claim = writable("")
  claimFailed = writable(false)
  roomCode = writable<string | undefined>()
  roomInviteError = writable<string | undefined>()
  isExplicitAuthError: Readable<boolean>
  isGenericError: Readable<boolean>

  constructor(url: string) {
    this.url = url
    this.authError = deriveRelayAuthError(url)
    this.isExplicitAuthError = derived([this.authError], ([$authError]) =>
      Boolean($authError && !isNetworkAuthError($authError)),
    )
    this.isGenericError = derived([this.authError], ([$authError]) =>
      Boolean($authError && isNetworkAuthError($authError)),
    )
  }

  createInviteStatus(requireCode: boolean) {
    return derived(
      [
        this.loading,
        this.isGenericError,
        this.isExplicitAuthError,
        this.roomInviteError,
        this.roomCode,
        this.claimFailed,
      ],
      ([$loading, $isGeneric, $isExplicit, $roomInviteError, $roomCode, $claimFailed]) => {
        if ($loading) return "loading" as const
        if ($isGeneric) return "network" as const
        if ($isExplicit || $roomInviteError) return "auth" as const
        if (requireCode && !$roomCode) return "failed" as const
        if ($claimFailed) return "noclaim" as const

        return "ready" as const
      },
    )
  }

  clearRestricted() {
    relaysMostlyRestricted.update(dissoc(this.url))
  }

  async attempt(claim = "") {
    return attemptRelayAccess(this.url, claim)
  }

  async configureNotifications(enabled: boolean) {
    if (enabled) {
      if (!notificationSettings.get().push) {
        await setSpaceNotifications(this.url, true)
      } else {
        const permissions = await Push.request()

        if (permissions.startsWith("granted")) {
          await setSpaceNotifications(this.url, true)
        }
      }
    } else {
      await setSpaceNotifications(this.url, false)
    }
  }

  async completeJoin(notifications: boolean) {
    await this.configureNotifications(notifications)
    await addSpace(this.url)
    this.clearRestricted()
    syncApplicationData()
    broadcastUserData([this.url])
  }

  async joinSpace({
    claim = "",
    notifications,
    alreadyJoined = false,
  }: {
    claim?: string
    notifications: boolean
    alreadyJoined?: boolean
  }) {
    if (!alreadyJoined) {
      const error = await this.attempt(claim)

      if (error) {
        return error
      }

      await this.completeJoin(notifications)
    }
  }

  async joinRoom(h: string, code?: string) {
    if (!code) return

    const message = await waitForThunkError(publishRoomJoinRequest(this.url, h, code))

    if (message && !message.startsWith("duplicate:")) {
      return message
    }
  }

  async acceptInvite(data: InviteData, notifications: boolean) {
    const alreadyInSpace = get(userSpaceUrls).includes(data.url)
    const error = await this.joinSpace({
      claim: data.claim,
      notifications,
      alreadyJoined: alreadyInSpace,
    })

    if (error) {
      return error
    }

    if (data.h && data.code) {
      return this.joinRoom(data.h, data.code)
    }
  }

  async prepareInvite(h?: string) {
    this.loading.set(true)

    // A request that times out or hits a closed socket resolves with no events, so an
    // empty result is the only signal we get that the relay never answered.
    const [events, roomInviteResult] = await Promise.all([
      request({
        relays: [this.url],
        autoClose: true,
        signal: AbortSignal.timeout(10000),
        filters: [{kinds: [RELAY_INVITE]}],
      }),
      h ? publishRoomInvite(this.url, h) : Promise.resolve({code: undefined, error: undefined}),
      // Keep the spinner up long enough that a fast relay doesn't make it flash
      sleep(300),
    ])

    this.claim.set(getTagValue("claim", events[0]?.tags || []) || "")
    this.claimFailed.set(events.length === 0)

    if (h) {
      this.roomCode.set(roomInviteResult.code)
      this.roomInviteError.set(roomInviteResult.error)
    }

    this.loading.set(false)
  }
}
