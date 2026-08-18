import {derived, writable, type Readable} from "svelte/store"
import {dissoc, fromPairs, last, poll, randomId, sleep, tryCatch} from "@welshman/lib"
import {AuthStatus, SocketStatus} from "@welshman/net"
import type {Socket} from "@welshman/net"
import {
  displayRelayUrl,
  isRelayUrl,
  makeEvent,
  normalizeRelayUrl,
  FOLLOWS,
  MESSAGING_RELAYS,
  PROFILE,
  RELAYS,
  type ManagementResponse,
} from "@welshman/util"
import {RelayJoin, RelayLeave, RoomJoin} from "@welshman/domain"
import {Sync, User, publish} from "@welshman/app"
import {stripPrefix} from "@lib/util"
import {app, command, relayManagement, roomLists, thunks, writer} from "@app/core"
import {PLATFORM_URL} from "@app/env"
import {relaysMostlyRestricted} from "@app/policies"
import {Push} from "@app/push"
import {deriveSocket} from "@app/relays"
import {notificationSettings, setSpaceNotifications} from "@app/settings"
import {syncApplicationData} from "@app/sync"

export const ROOM_CREATE_INVITE = 9009

export type InviteData = {
  url: string
  claim: string
  h?: string
  code?: string
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

export const publishJoinRequest = (url: string, claim = "") =>
  command(writer(RelayJoin).forceRelays(url).setClaim(claim)).then(publish)

export const publishLeaveRequest = (url: string) =>
  command(writer(RelayLeave).forceRelays(url)).then(publish)

export const publishRoomJoinRequest = (url: string, h: string, code?: string) => {
  const eventWriter = writer(RoomJoin).setRoom(url, h)

  if (code) {
    eventWriter.setClaim(code)
  }

  return command(eventWriter).then(publish)
}

export const publishRoomInvite = async (url: string, h: string) => {
  const code = randomId()
  const event = makeEvent(ROOM_CREATE_INVITE, {
    tags: [
      ["h", h],
      ["code", code],
    ],
  })

  const error = await thunks
    .get()
    .publish({event, relays: [url]})
    .waitForError()

  if (error) {
    return {error, code: undefined}
  }

  return {error: undefined, code}
}

const authTerminalStatuses = [
  AuthStatus.None,
  AuthStatus.Ok,
  AuthStatus.Forbidden,
  AuthStatus.DeniedSignature,
]

const waitForAuth = async (socket: Socket) => {
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
  const socket = app.get().pool.get(url)

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
    await socket.auth.retryAuth(User.require(app.get()).sign)
    await waitForAuth(socket)
  }

  if (![AuthStatus.None, AuthStatus.Ok].includes(socket.auth.status)) {
    return formatAuthError(socket.auth.status, socket.auth.details)
  }

  const thunk = await publishJoinRequest(url, claim)
  const error = await thunk.waitForError()

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
    await roomLists.get().addRelay(this.url).then(publish)
    this.clearRestricted()
    syncApplicationData()
    app
      .get()
      .use(Sync)
      .push({
        relays: [this.url],
        filters: [
          {
            kinds: [RELAYS, MESSAGING_RELAYS, FOLLOWS, PROFILE],
            authors: [User.require(app.get()).pubkey],
          },
        ],
      })
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

    const thunk = await publishRoomJoinRequest(this.url, h, code)
    const message = await thunk.waitForError()

    if (message && !message.startsWith("duplicate:")) {
      return message
    }
  }

  async acceptInvite(data: InviteData, notifications: boolean) {
    const spaceUrls = roomLists.get().urls(User.require(app.get()).pubkey).get()
    const error = await this.joinSpace({
      claim: data.claim,
      notifications,
      alreadyJoined: spaceUrls.includes(data.url),
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

    try {
      const management = relayManagement.get().forUrl(this.url)

      const [{result: methods}, roomInviteResult] = await Promise.all([
        management.supportedMethods().catch((error): ManagementResponse => {
          console.error(error)
          return {}
        }),
        h ? publishRoomInvite(this.url, h) : Promise.resolve({code: undefined, error: undefined}),
        // Keep the spinner up long enough that a fast relay doesn't make it flash
        sleep(300),
      ])

      // The relay reports methods relay-wide rather than per-user, so a listed method can
      // still come back "blocked" for this particular user — treat that as having no claim.
      if (methods?.includes("createclaim")) {
        const {result: claims} = await management.listClaims()

        if (claims?.[0]) {
          this.claim.set(claims[0])
        } else {
          const claim = randomId()
          const {error} = await management.createClaim(claim)

          if (error) {
            this.claimFailed.set(true)
          } else {
            this.claim.set(claim)
          }
        }
      }

      if (h) {
        this.roomCode.set(roomInviteResult.code)
        this.roomInviteError.set(roomInviteResult.error)
      }
    } finally {
      this.loading.set(false)
    }
  }
}
