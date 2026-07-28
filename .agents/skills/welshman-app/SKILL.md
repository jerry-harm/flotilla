---
name: welshman-app
description: "Use this skill when working with @welshman/app: the App instance and its plugins, sessions and login, publishing via Commands and Thunks, app policies, WoT, feeds, sync, or relay selection at the app layer."
---

# welshman/app — The App Instance and its Plugins

`@welshman/app` composes `net`, `store`, `domain`, `signer`, and `feeds` into an application
framework built around a single `App` object.

## Installation

```bash
npm i @welshman/app
```

## The App

```typescript
import {App, createApp, User} from "@welshman/app"

const app = createApp({
  user: await User.fromSigner(signer),   // omit for a signed-out app
  config: {
    dufflepudUrl: "https://dufflepud.example.com",
    getDefaultRelays: () => ["wss://relay.example.com"],
    getIndexerRelays: () => ["wss://indexer.example.com"],
    getSearchRelays: () => ["wss://search.example.com"],
  },
  getAdapter,                            // optional: custom net adapters (tests, mocks)
  policies,                              // optional: overrides the defaults
})
```

An `App` owns everything scoped to one identity:

| Property | What it is |
|---|---|
| `app.user` | the signed-in `User`, or `undefined` |
| `app.config` | the `AppConfig` above |
| `app.repository` | this identity's event store |
| `app.tracker` | which relays each event was seen on |
| `app.pool` | socket pool |
| `app.wrapManager` | NIP-59 gift wrap bookkeeping |
| `app.netContext` | `{pool, repository, getAdapter}` for the net layer |
| `app.use(Plugin)` | resolve a per-app plugin singleton |
| `app.cleanup()` | run policy teardown and clear pool/tracker/repository |

`createApp` is `new App` plus `defaultAppPolicies`. Use `new App({policies: [...]})` for a bare app.

**An app is scoped to one identity.** To log in, build a *new* app and `cleanup()` the old one —
never attach a user to an existing app. That's what keeps one account's data out of another's
repository.

## Plugins

`app.use(Ctor)` constructs the plugin on first use and memoizes it per app, so calling it inline
is cheap and idiomatic:

```typescript
app.use(Profiles).load(pubkey)
app.use(RelayLists).writeUrls(pubkey).get()
```

### Plugin base classes

| Base | Shape |
|---|---|
| `MapPlugin<T>` | a plain keyed map of non-event data (relay stats, NIP-11 info) |
| `LoadableMapPlugin<T>` | a `MapPlugin` that knows how to `fetch(key)` from the network |
| `DerivedPlugin<T>` | a keyed collection **derived from the repository** — the repository is the source of truth, never a duplicated map |
| `RelayScopedDerivedPlugin<T>` | keyed by `getKey(item, url)` per relay, for data that only means something relative to a relay |
| `RelaySignedDerivedPlugin<T>` | the same, but only accepts events authored by the relay's NIP-11 `self` pubkey (NIP-29 room state, relay membership/roles) |

Derived plugins expose:

- `index` — `Projection<ItemsByKey<T>>`
- `all` — `Projection<T[]>`
- `one(key)` — a store for a single key, loading it on first subscribe
- `get(key)` — synchronous snapshot
- `load(key)` / `forceLoad(key)` — network fetch (cached / uncached)
- `project(key, read)` — a `Projection` derived from one key

A **`Projection<T>` is `{get(): T, $: Readable<T>}`** — bind `.$` in markup, call `.get()` in
callbacks and hot paths. Build new ones with `projection(store)` or `projectFrom(source, read)`.

### Available plugins

**Core:** `Network`, `Router`, `Domain`, `Thunks`, `Sync`, `Logger`, `Plaintext`

**Relays:** `Relays` (NIP-11), `RelayStats`, `RelayManagement` (NIP-86), `RelayLists`,
`BlockedRelayLists`, `SearchRelayLists`, `MessagingRelayLists`, `BlossomServerLists`

**People:** `Profiles`, `FollowLists`, `MuteLists`, `Handles`, `Zappers`, `Wot`, `Topics`

**Content:** `Reactions`, `Deletes`, `Pins`, `Pinboards`, `Feeds`, `FeedLists`, `Wraps`

**NIP-29 / membership:** `Rooms`, `RoomLists`, `RoomPinLists`, `RelayMemberLists`, `RelayRoles`

## Sessions and login

A `Session` is `{method, ...data}`, serializable so you can persist it. Handlers convert one into
a signer: `nip01`, `nip07`, `nip46`, `nip55`, `pomade`, plus `registerSessionHandler` for your own.

```typescript
import {User, createApp, nip07, toSession} from "@welshman/app"

const session = toSession(nip07, {pubkey})
const user = await User.fromSession(session)   // undefined if the handler can't build a signer

const app = createApp({user})
```

`User` wraps a signer and pubkey:

- `User.fromSigner(signer)` / `User.fromSession(session)`
- `User.require(app)` — the signed-in user or **throws**; use on paths that require login
- `user.sign(event)`, `user.wrapSigner(fn)`

Persist the `Session`, not the `User` — rebuild the user on startup and construct the app with it.

## Publishing

Two layers, and you usually want the first.

### Commands

A `Command` owns a rendered event plus the relays routing resolved for it:

```typescript
import {Domain, publish} from "@welshman/app"
import {Note} from "@welshman/domain"

const writer = app.use(Domain).writer(Note).setContent("hello")
const command = await app.use(Domain).command(writer)

command.publish()                 // to the resolved relays
command.publishToRelays(urls)     // to specific relays
command.publishAsRelay(url)       // signed by the relay itself (NIP-86)
```

Plugin mutators already return a `Command`, so `.then(publish)` is the common shape:

```typescript
await app.use(FollowLists).follow(["p", pubkey]).then(publish)
await app.use(RelayLists).addWriteUrl(url).then(publish)
```

Free-function forms exist for pipelines: `publish`, `publishToRelays(urls)`,
`publishAsRelay(url)`, `signAsRelay(url)`.

### Thunks

`app.use(Thunks).publish({event, relays, delay})` publishes optimistically: the event lands in the
local repository immediately, so the UI updates before the network settles. The returned `Thunk`
is a store you can render:

```typescript
const thunk = app.use(Thunks).publish({event, relays})

thunk.getUrlsWithStatus(PublishStatus.Success)
thunk.getFailedUrls()
thunk.isComplete()
await thunk.waitForError()        // "" when everything succeeded
await thunk.waitForCompletion()
```

`app.use(Thunks).history` is a writable of every thunk this app has published — useful for a
"sending" indicator or deciding which relays the user has actually written to.

## Requests

```typescript
const network = app.use(Network)

network.load({relays, filters})            // batched, deduped, shared loader
network.request({relays, filters, onEvent})
network.publish({event, relays})
network.loadUsingOutbox(pubkey, filter)     // newest matching event from the author's write relays
network.loadAllUsingOutbox(pubkey, filter)  // every matching event
```

Prefer a plugin's `one(key)` / `load(key)` when one exists — they handle outbox routing and
caching for you. The bare `load`/`request`/`publish` from `@welshman/net` need an explicit
`context`; `Network` supplies `app.netContext`.

## Relay selection

Routing is the `RelaySelection` DSL from `@welshman/util`, resolved by `app.use(Router)`:

```typescript
import {outbox, inbox, seen, userOutbox, indexers, relay, relays} from "@welshman/util"

const scenario = await app.use(Router).resolve([userOutbox(), outbox(pubkey)])
const urls = scenario.getUrls()

// single best relay for a route
const hint = await app.use(Router).resolver.relay([outbox(event.pubkey)])
```

Selections are weighted (`outbox(pubkey, 2)`), and resolution is **async** — it may need to load
the target's relay list first.

## App policies

An `AppPolicy` is `(app) => Unsubscriber`, applied once at construction and torn down by
`cleanup()`. Policies own everything that subscribes or wires components together, keeping the
data classes free of side effects.

Built-ins: `appPolicyIngest`, `appPolicyRelayStats`, `appPolicyWraps`, `appPolicyCacheDecrypt`,
`appPolicyLogSignerMethods`, plus auth: `appPolicyAuthNever`, `appPolicyAuthAlways`,
`appPolicyAuthUnlessBlocked`, and `makeAppPolicyAuth(shouldAuth)` for a custom predicate.

```typescript
const app = createApp({
  user,
  policies: [...defaultAppPolicies, appPolicyAuthUnlessBlocked, myPolicy],
})

const myPolicy: AppPolicy = app => {
  const unsubscribe = on(app.repository, "update", handleUpdate)

  return unsubscribe
}
```

**Ordering gotcha:** policies run in the `App` constructor. If a policy module imports something
that transitively imports your app module, construct the app lazily (on first access) so every
policy has registered by the time it's built.

## Web of trust

```typescript
const wot = app.use(Wot)

wot.follows(pubkey).get()
wot.followers(pubkey).get()
wot.network(pubkey).$              // follows-of-follows
wot.followsWhoFollow(pubkey, target).$
wot.wotScore(pubkey, target).$
```

## Feeds and sync

```typescript
app.use(Feeds).makeFeedController({feed, onEvent, ...})
app.use(Feeds).getPubkeysForScope(scope)
app.use(Feeds).forAuthor(pubkey).$

app.use(Sync).pull({relays, filters})   // negentropy: fetch what we're missing
app.use(Sync).push({relays, filters})   // publish what the relay is missing
```

## Using welshman stores outside Svelte

Projections and plugin stores implement the Svelte store contract — `subscribe(cb) → unsubscribe`,
firing synchronously with the current value — so they adapt to any reactive framework with a small
hook. Only the `svelte/store` *types* are needed, not the runtime.

```typescript
// React
const useStore = <T>(store: Readable<T>): T => {
  const [value, setValue] = useState<T>(() => get(store))

  useEffect(() => store.subscribe(setValue), [store])

  return value
}
```

For a `Projection`, subscribe to `.$` and read `.get()` for a synchronous snapshot.

## Related skills

- `welshman-domain` — the readers/writers every plugin decodes events with
- `welshman-net` — sockets, adapters, request/publish lifecycle, auth
- `welshman-store` — the repository and the derive helpers plugins are built on
- `welshman-signer` — signer implementations behind `User`
- `welshman-util` — kinds, filters, tag specs, and the `RelaySelection` DSL
