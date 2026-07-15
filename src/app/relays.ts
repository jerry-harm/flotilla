import {
  ManagementMethod,
  getRelaysFromList,
  isShareableRelayUrl,
  isSignedEvent,
  normalizeRelayUrl,
} from "@welshman/util"
import type {List, RelayProfile} from "@welshman/util"
import {AuthStateEvent, AuthStatus, Pool, SocketEvent, SocketStatus} from "@welshman/net"
import {derived, readable} from "svelte/store"
import type {Maybe} from "@welshman/lib"
import {call, on, simpleCache, uniq} from "@welshman/lib"
import {throttled} from "@welshman/store"
import {getRelay, loadRelay, manageRelay, publishThunk, waitForThunkError} from "@welshman/app"
import {checkRelayHasLivekit} from "$lib/livekit"
import {stripPrefix} from "@lib/util"
import {relaysMostlyRestricted} from "@app/policies"

export const hasNip29 = (relay?: RelayProfile) =>
  Boolean(relay?.supported_nips?.map?.(String)?.includes?.("29"))

export const hasNip50 = (relay?: RelayProfile) =>
  Boolean(relay?.supported_nips?.map?.(String)?.includes?.("50"))

export const hasNip70 = (relay?: RelayProfile) =>
  Boolean(relay?.supported_nips?.map?.(String)?.includes?.("70"))

export const encodeRelay = (url: string) =>
  encodeURIComponent(
    normalizeRelayUrl(url)
      .replace(/^wss:\/\//, "")
      .replace(/\/$/, ""),
  )

export const decodeRelay = (url: string) => normalizeRelayUrl(decodeURIComponent(url))

// A hosted relay whose custom domain changed keeps 301-ing its old host to the
// new one; the NIP-11 fetch surfaces that (the socket can't). Returns the new
// wss:// url, or undefined when there's no redirect or the fetch fails.
export const fetchRelayRedirect = async (url: string): Promise<Maybe<string>> => {
  try {
    const response = await fetch(url.replace(/^ws/, "http"), {
      headers: {Accept: "application/nostr+json"},
    })

    if (!response.redirected) return undefined

    const next = normalizeRelayUrl(response.url.replace(/^http/, "ws"))

    return next === normalizeRelayUrl(url) ? undefined : next
  } catch {
    return undefined
  }
}

export const deriveSocket = (url: string) => {
  const socket = Pool.get().get(url)

  return readable(socket, set => {
    const subs = [
      on(socket, SocketEvent.Error, () => set(socket)),
      on(socket, SocketEvent.Status, () => set(socket)),
      on(socket.auth, AuthStateEvent.Status, () => set(socket)),
    ]

    return () => subs.forEach(call)
  })
}

export const deriveSocketStatus = (url: string) =>
  throttled(
    800,
    derived([deriveSocket(url), relaysMostlyRestricted], ([$socket, $relaysMostlyRestricted]) => {
      if ($socket.status === SocketStatus.Opening) {
        return {theme: "warning", title: "Connecting"}
      }

      if ($socket.status === SocketStatus.Closing) {
        return {theme: "gray-500", title: "Not Connected"}
      }

      if ($socket.status === SocketStatus.Closed) {
        return {theme: "gray-500", title: "Not Connected"}
      }

      if ($socket.status === SocketStatus.Error) {
        return {theme: "error", title: "Failed to Connect"}
      }

      if ($socket.auth.status === AuthStatus.Requested) {
        return {theme: "warning", title: "Authenticating"}
      }

      if ($socket.auth.status === AuthStatus.PendingSignature) {
        return {theme: "warning", title: "Authenticating"}
      }

      if ($socket.auth.status === AuthStatus.DeniedSignature) {
        return {theme: "error", title: "Failed to Authenticate"}
      }

      if ($socket.auth.status === AuthStatus.PendingResponse) {
        return {theme: "warning", title: "Authenticating"}
      }

      if ($socket.auth.status === AuthStatus.Forbidden) {
        return {theme: "error", title: "Access Denied"}
      }

      if ($relaysMostlyRestricted[url]) {
        return {theme: "error", title: "Access Denied"}
      }

      return {theme: "success", title: "Connected"}
    }),
  )

export const signAsRelay = async (url: string, template: object): Promise<string | undefined> => {
  const {result, error} = await manageRelay(url, {
    method: "signevent" as ManagementMethod,
    params: [template as unknown as string],
  })

  if (error) return error

  if (!isSignedEvent(result)) return "Relay returned an invalid event"

  return stripPrefix(await waitForThunkError(publishThunk({event: result, relays: [url]})))
}

export const deriveSupportedMethods = simpleCache(([url]: [string]) => {
  return readable<ManagementMethod[]>([], set => {
    manageRelay(url, {
      method: ManagementMethod.SupportedMethods,
      params: [],
    }).then(({result = []}) => set(result))
  })
})

export const deriveHasLivekit = simpleCache(([url]: [string]) =>
  readable<boolean | undefined>(undefined, set => {
    checkRelayHasLivekit(url).then(has => set(has))
  }),
)

export const discoverRelays = (lists: List[]) =>
  Promise.all(
    uniq(lists.flatMap($l => getRelaysFromList($l)))
      .filter(isShareableRelayUrl)
      .map(url => loadRelay(url)),
  )

export const canEnforceNip70 = (url: string) => hasNip70(getRelay(url))
