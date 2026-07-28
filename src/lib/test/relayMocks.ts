import {on} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {isRelayUrl, normalizeRelayUrl} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {AbstractAdapter, AdapterEvent, LocalAdapter, Repository} from "@welshman/net"
import type {AdapterFactory, ClientMessage, RelayMessage} from "@welshman/net"

// The window key Playwright writes the mock config to (see e2e/support/relayMocks.ts). Keep it in
// sync with the literal duplicated there.
export const RELAY_MOCKS_KEY = "__RELAY_MOCKS__"

export type RelayMockConfig = {
  // Map of relay url -> events that relay should return. Any relay NOT listed returns nothing (an
  // immediate EOSE), which is what keeps tests offline and reproducible by default.
  relays?: Record<string, TrustedEvent[]>
}

// Wraps welshman's LocalAdapter so we reuse its REQ/EVENT/CLOSE handling against an in-memory
// Repository, but re-emits its messages under the real relay url instead of LOCAL_RELAY_URL. That
// keeps relay attribution / relay-scoped behaviour (e.g. NIP-29 groups) working as it would over a
// real socket. (Composition rather than inheritance because LocalAdapter emits via a private method
// that hardcodes LOCAL_RELAY_URL.)
class FixtureAdapter extends AbstractAdapter {
  readonly local: LocalAdapter

  constructor(
    readonly url: string,
    repository: Repository,
  ) {
    super()

    this.local = new LocalAdapter(repository)

    const forward = (message: RelayMessage) => this.emit(AdapterEvent.Receive, message, this.url)

    this._unsubscribers.push(on(this.local, AdapterEvent.Receive, forward), () =>
      this.local.cleanup(),
    )
  }

  get sockets() {
    return this.local.sockets
  }

  get urls() {
    return [this.url]
  }

  send(message: ClientMessage) {
    this.local.send(message)
  }
}

// An adapter factory serving every real relay url from memory, so no websocket is ever created for
// one. Non-relay urls (e.g. the local:// repository relay) fall through to welshman's default
// handling by returning undefined.
export const makeRelayMockAdapter = (config: RelayMockConfig): AdapterFactory => {
  const reposByUrl = new Map<string, Repository>()

  for (const [url, events] of Object.entries(config.relays ?? {})) {
    const repository = new Repository()
    repository.load(events)
    reposByUrl.set(normalizeRelayUrl(url), repository)
  }

  const emptyRepository = new Repository()

  return (url: string) => {
    if (isRelayUrl(url)) {
      return new FixtureAdapter(url, reposByUrl.get(normalizeRelayUrl(url)) ?? emptyRepository)
    }
  }
}

// Called when the app is created. Yields an adapter factory only when Playwright has injected a
// config, so it is a no-op for real users.
export const maybeMakeRelayMockAdapter = (): Maybe<AdapterFactory> => {
  const config = (globalThis as {[RELAY_MOCKS_KEY]?: RelayMockConfig})[RELAY_MOCKS_KEY]

  if (config) {
    return makeRelayMockAdapter(config)
  }
}
