---
name: welshman-domain
description: "Use this skill when working with @welshman/domain: reading or writing a specific nostr event kind, parsing tags, building events to publish, or adding support for a new kind. Provides a typed Reader/Writer pair per kind so you never hand-parse tags."
---

# welshman/domain — Typed Readers and Writers per Kind

`@welshman/domain` replaces ad-hoc tag digging. Every supported kind gets a **Reader** (typed
accessors over an event) and a **Writer** (a builder that renders a new event), paired in a
`KindFactory`.

**The rule this package exists to enforce:** never reach into `event.tags` yourself. Use the
reader's getter (`note.content()`, `roomMeta.name()`, `goal.amount()`). If a kind has no reader,
use `tagValue`/`tagValues` from `@welshman/util` — not `tags.find(...)`.

## Installation

```bash
npm i @welshman/domain
```

## The three pieces

```typescript
import {KindFactory} from "@welshman/domain"

KindFactory        // the exported per-kind object, e.g. `Note`, `Profile`, `RoomMeta`
  .configure(ctx)  // binds a resolver/signer -> ConfiguredKind
  .reader(event)   // -> Reader instance (call .parse() before use)
  .writer(reader?) // -> Writer, optionally seeded from an existing reader to edit it
```

You rarely call `configure` directly — the `Domain` plugin does it for you.

## Usage through an app

```typescript
import {Domain} from "@welshman/app"
import {Note, Profile} from "@welshman/domain"

// Read: returns a parsed reader, ready to use
const note = app.use(Domain).reader(Note)(event)

note.content()      // typed accessors, no tag digging
note.author()
note.createdAt()

// Write: build, then wrap in a Command to publish
const writer = app.use(Domain).writer(Note).setContent("hello").addMention(pubkey)
const command = await app.use(Domain).command(writer)

await command.publish().waitForError()

// Edit an existing event: seed the writer with its reader
const profile = app.use(Domain).reader(Profile)(profileEvent)
const edit = app.use(Domain).writer(Profile, profile).setName("new name")
```

## Sync vs async readers

Some kinds decrypt on parse (encrypted lists, app data), so `parse()` is async for them:

- `EventReader.parse(): this`
- `AsyncEventReader.parse(): Promise<this>`

`Parsed<R> = ReturnType<R["parse"]>` captures which one you get. `app.use(Domain).reader(F)`
returns `Parsed<R>` — the reader itself for sync kinds, a promise for async ones. That's exactly
what `EventToItem` accepts, so collections keep their synchronous path where the kind allows one.

```typescript
const note = app.use(Domain).reader(Note)(event)          // NoteReader
const list = await app.use(Domain).reader(MuteList)(event) // MuteListReader (decrypts)
```

## Reader base API

Every reader inherits from `BaseEventReader`:

| Method | Returns |
|---|---|
| `id()` | event id |
| `author()` | pubkey |
| `content()` | content string |
| `tags()` | raw tags (prefer a typed getter when one exists) |
| `createdAt()` | timestamp |
| `identifier()` | `d` tag |
| `address()` | `kind:pubkey:d` |
| `room()` | `h` tag |
| `protect()` | whether the event carries `-` (NIP-70) |
| `expiration()` | `expiration` tag as a number |
| `emojis()` | parsed `emoji` tags |
| `zapSplits()` | parsed `zap` tags |

Kind-specific readers add their own on top — `RoomMetaReader.name()`, `ZapGoalReader.amount()`,
`RelayMembersReader.isMember(pubkey)`, and so on.

## Writer base API

Writers are chainable and validate on render:

```typescript
writer
  .setContent(content)
  .addTags(...tags)
  .dropTags(pred)              // also keepTags(pred)
  .setIdentifier(d)            // defaults to a random id
  .setRoom(url, h)             // NIP-29 `h` tag + forced relay
  .setProtected(true)          // NIP-70 `-`
  .setExpiration(ts)
  .addMention(pubkey)
  .addQuote(event)
  .addZapSplit(pubkey, split)
  .addEmoji(shortcode, url)
  .forceRelays(...urls)        // bypass routing for relay-scoped kinds
```

`readonly requiresRelays` marks kinds that are meaningless without an explicit relay (NIP-29 room
ops, relay membership). Subclasses override `validate()` to enforce kind-specific invariants —
e.g. `RoomUpdatePins` throws without a room, `ZapGoal` requires an amount and at least one relay.

## Display helpers

A few kinds export display helpers alongside their reader:

```typescript
import {displayPubkey} from "@welshman/domain"

profile.display("Anonymous")   // ProfileReader: name/display_name, or the fallback
displayPubkey(pubkey)          // 'npub1abc...xyz'
```

## Adding a new kind

1. Add the kind constant to `@welshman/util`'s `Kinds.ts`.
2. Create `packages/domain/src/kinds/YourKind.ts` with a Reader, a Writer, and the factory:

```typescript
import {uniq, spec} from "@welshman/lib"
import {YOUR_KIND, hexTags, tagValues} from "@welshman/util"
import {EventReader} from "../core/EventReader.js"
import {EventWriter} from "../core/EventWriter.js"
import {KindFactory} from "../core/Kind.js"

export class YourKindReader extends EventReader {
  pubkeys() {
    return uniq(tagValues(hexTags("p"), this.event.tags))
  }
}

export class YourKindWriter extends EventWriter<YourKindReader> {
  readonly requiresRelays = true

  validate() {
    super.validate()

    if (!this.roomTag) throw new Error("YourKind requires a room")
  }

  setPubkeys(pubkeys: string[]) {
    return this.dropTags(spec(["p"])).addTags(...uniq(pubkeys).map(pk => ["p", pk]))
  }
}

export const YourKind = new KindFactory({
  kind: YOUR_KIND,
  reader: YourKindReader,
  writer: YourKindWriter,
})
```

3. Export it from `packages/domain/src/index.ts`.
4. Add `packages/domain/__tests__/YourKind.test.ts` — every kind has one. Use the `read`, `write`,
   and `buildTemplate` helpers from `./helpers.js`, and cover: reading represented tags,
   round-tripping without duplicating tags, and any `validate()` rule.

## Available kinds

Profile, Note, Comment, Thread, Delete, Reaction, Report, Poll, PollResponse, Classified,
TimeEvent, AppData, Handler, HandlerRecommendation, Feed, Pin, Pinboard.

Lists: FollowList, MuteList, PinList, BookmarkList, TopicList, EmojiList, RelayList, RelaySet,
SearchRelayList, MessagingRelayList, BlossomServerList, BlockedRelayList, CommunityList,
FeedList, RoomList.

Zaps: ZapRequest, ZapReceipt, ZapGoal.

NIP-29 rooms: RoomMeta, RoomCreate, RoomEdit, RoomDelete, RoomJoin, RoomLeave, RoomAddMember,
RoomRemoveMember, RoomMembers, RoomAdmins, RoomCreatePermission, RoomPins, RoomUpdatePins.

Relay membership: RelayInvite, RelayJoin, RelayLeave, RelayAddMember, RelayRemoveMember,
RelayMembers, RelayRole.

## Related skills

- `welshman-app` — the `Domain` plugin, `Command`, and the collections that decode events for you
- `welshman-util` — kind constants, tag specs (`tagValue`, `hexTags`, `addressTags`), filters
- `welshman-store` — indexing decoded readers into reactive collections
