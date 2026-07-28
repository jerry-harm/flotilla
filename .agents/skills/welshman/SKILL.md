---
name: welshman
description: "Use this skill for general welshman questions: architecture overview, which package to use, getting started, nostr concepts, or when you're unsure which sub-skill applies. Welshman is a modular TypeScript nostr toolkit for building client applications."
---

## What is welshman

Welshman is a modular TypeScript nostr toolkit extracted from the [Coracle](https://coracle.social) nostr client, designed for building highly configurable nostr client applications. It is production-tested, powering both Coracle and [Flotilla](https://flotilla.social). Packages are independent and opt-in — you can grab a single utility or use the full batteries-included framework.

## Package map

| Package | Description |
|---|---|
| `@welshman/util` | Core nostr types, event helpers, filters, tag specs, NIPs, and the `RelaySelection` routing DSL |
| `@welshman/lib` | General-purpose utilities: LRU cache, event emitter, deferred promises, task queue |
| `@welshman/net` | Relay connections, request/publish lifecycle, and auth handling |
| `@welshman/domain` | A typed Reader/Writer pair per event kind, so you never hand-parse tags |
| `@welshman/store` | Svelte stores and a Repository for indexing/querying nostr events client-side |
| `@welshman/signer` | Signing and login methods: NIP-01 (privkey), NIP-07 (extension), NIP-46 (bunker), NIP-55 (app), NIP-59 (gift wrap) |
| `@welshman/feeds` | Dynamic feed construction, filtering, and composition |
| `@welshman/app` | The `App` instance and its plugin registry, composing net, store, domain, signer, and feeds into a full application framework |
| `@welshman/content` | Parser and renderer for nostr note content (links, mentions, media, custom formatting) |
| `@welshman/editor` | Batteries-included Svelte rich-text editor component with mention and embed support |

## Dependency layering

Packages are layered so lower-level ones have no welshman dependencies:

- **Foundational** (no welshman deps): `@welshman/lib`, `@welshman/util`
- **Mid-level** (depend only on foundational): `@welshman/net`, `@welshman/store`, `@welshman/signer`, `@welshman/domain`
- **Composing** (depend on mid-level + foundational): `@welshman/feeds`, `@welshman/app`
- **UI-focused** (largely independent, UI rendering concerns): `@welshman/content`, `@welshman/editor`

For deep-dives on any package, load the `welshman-<name>` skill (e.g. `welshman-net`, `welshman-app`, `welshman-domain`).

## The App instance

Everything in the framework hangs off one `App`. An app owns the primitives a single identity
needs — repository, socket pool, tracker, wrap manager — so data never bleeds across sessions.

```typescript
import {createApp, Network, Profiles, User} from "@welshman/app"

// `createApp` = `new App` plus the default policies (ingest, relay stats, gift-wrap unwrapping)
const app = createApp({
  user: await User.fromSigner(signer),   // omit for a signed-out app
  config: {
    getDefaultRelays: () => ["wss://relay.example.com"],
    getIndexerRelays: () => ["wss://indexer.example.com"],
  },
})

app.use(Profiles).load(pubkey)           // plugins are per-app singletons, constructed on demand
app.use(Network).load({relays, filters})
```

Three rules follow from this design:

1. **`app.use(Plugin)` is memoized and cheap** — call it inline rather than caching the result.
2. **An app is scoped to one identity.** Logging in means building a *new* app and calling
   `cleanup()` on the old one, not attaching a user to the existing one.
3. **Side effects live in policies**, not in the data classes. An `AppPolicy` is
   `(app) => Unsubscriber`, applied once at construction and torn down by `cleanup()`.

Svelte apps typically wrap `app` in a store so plugin reads re-subscribe when login swaps the
instance. That binding layer is app-specific and deliberately not part of welshman.

## Key nostr concepts

- **event** — the fundamental data unit in nostr; a JSON object signed by a keypair
- **kind** — integer field on an event that determines its type (e.g. kind 1 = short text note, kind 0 = profile metadata)
- **filter** — a query object (`{kinds, authors, since, until, limit, ...}`) sent to relays to request matching events
- **relay** — a WebSocket server that stores and forwards nostr events; clients connect to multiple relays
- **NIP** — "Nostr Implementation Possibility"; numbered specifications defining protocol behavior and event kinds
- **pubkey** — 32-byte hex public key that identifies a nostr user
- **signer** — abstraction over key management; handles signing events and optionally encryption, regardless of where the private key lives (in-memory, browser extension, remote bunker, mobile app)

## Common use-case routing

| Goal | Package(s) to use |
|---|---|
| Fetch notes from relays | `app.use(Network)`, or `@welshman/net` directly for low-level control |
| Select which relays to use | `RelaySelection` helpers in `@welshman/util` + `app.use(Router)` |
| Read or write a specific kind | `@welshman/domain` via `app.use(Domain)` |
| Sign and publish events | `@welshman/signer` + `Command` from `@welshman/app` |
| Build a feed UI | `@welshman/feeds` + `app.use(Feeds)` |
| Parse note text and media | `@welshman/content` |
| Embed a composer / editor | `@welshman/editor` |
| Cache nostr events client-side | `@welshman/store` + `app.repository` |
| Core event/filter/tag utilities | `@welshman/util` |
| Low-level helpers (LRU, emitter, utility functions) | `@welshman/lib` |

## App example

```typescript
import {createApp, Domain, Profiles, User} from "@welshman/app"
import {Note} from "@welshman/domain"
import {Nip07Signer} from "@welshman/signer"

// 1. Build an app for the signed-in user
const signer = new Nip07Signer()
const app = createApp({
  user: await User.fromSigner(signer),
  config: {
    getDefaultRelays: () => ["wss://relay.example.com"],
    getIndexerRelays: () => ["wss://indexer.example.com"],
  },
})

// 2. Read the user's profile (loads from their write relays if not cached)
const profile = await app.use(Profiles).load(app.user!.pubkey)

console.log("Hello,", profile?.display())

// 3. Publish a note — build a writer, wrap it in a command, publish it
const writer = app.use(Domain).writer(Note).setContent("Hello, Nostr!")
const command = await app.use(Domain).command(writer)

await command.publish().waitForError()
```

Publishing goes through a `Command`, which owns the rendered event and its resolved relays:
`command.publish()`, `.publishToRelays(urls)`, or `.publishAsRelay(url)`. Plugin mutators
(`app.use(FollowLists).follow(...)`, `app.use(Rooms).joinRoom(...)`) already return a `Command`,
so `.then(publish)` is usually all you need.

## Lower-level example

The net layer takes an explicit context, so it can be used without an `App` at all.

```typescript
import {AbstractAdapter, isClientEvent, publish, request} from "@welshman/net"
import type {ClientMessage, NetContext} from "@welshman/net"
import {call, sleep} from "@welshman/lib"
import {Nip01Signer} from "@welshman/signer"
import {makeEvent, NOTE} from "@welshman/util"

const pingSigner = Nip01Signer.fromSecret(/* nostr hex secret key */)
const pongSigner = Nip01Signer.fromSecret(/* nostr hex secret key */)
const RELAY_URL = "bogus.relay"

// An adapter for our relay url which just prints the content
export class PrintAdapter extends AbstractAdapter {
  get sockets() { return [] }
  get urls() { return [] }
  send = (message: ClientMessage) => {
    if (isClientEvent(message)) {
      const [_, event] = message
      console.log(event.content)
    }
  }
}

// Context is passed explicitly. An `App` supplies its own via `app.netContext`; here we build one.
const context: NetContext = {
  getAdapter: (url: string) => (url === RELAY_URL ? new PrintAdapter() : undefined),
}

call(async () => {
  while (true) {
    await sleep(1000)

    const ping = await pingSigner.sign(makeEvent(NOTE, {content: "ping"}))

    await publish({event: ping, relays: [RELAY_URL], context})
  }
})

call(async () => {
  request({
    relays: [RELAY_URL],
    filters: [{kinds: [NOTE], authors: [await pingSigner.getPubkey()]}],
    context,
    onEvent: async (ping, url) => {
      const pong = await pongSigner.sign(
        makeEvent(NOTE, {content: "pong", tags: [["q", ping.id, RELAY_URL, ping.pubkey]]}),
      )

      await publish({event: pong, relays: [RELAY_URL], context})
    },
  })
})
```
