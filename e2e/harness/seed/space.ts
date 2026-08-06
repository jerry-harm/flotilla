import {neventEncode} from "nostr-tools/nip19"
import type {Maybe, MaybeAsync} from "@welshman/lib"
import {
  MESSAGE,
  ROOM_ADD_MEMBER,
  Resolver,
  makeEvent,
  tagSpec,
  tagValue,
  toNostrURI,
} from "@welshman/util"
import type {SignedEvent, StampedEvent} from "@welshman/util"
import {EventWriter, Profile} from "@welshman/domain"
import type {BaseEventReader} from "@welshman/domain"
import type {RoomOptions, TestRelay} from "../zooid/types"
import type {Zooid} from "../zooid/relay"
import type {TenantName} from "../zooid/config"
import {users} from "../keys"
import type {TestUser} from "../keys"

// @welshman/domain has no writer for NIP-29 kind-9 messages, and none of its readers describe one,
// so this pairs the base writer with the base reader. The behavior tags it renders — `h` via
// setRoom, `q`/`p` via addQuote/addMention — are everything a room message carries.
class MessageWriter extends EventWriter<BaseEventReader> {}

// A handle to an event the scenario is going to publish. Seeding calls record what to write and
// return before anything is written, so the event is filled in when its turn in the queue comes up.
export type SeededEvent = {
  readonly event: SignedEvent
  readonly id: string
}

export type ProfileValues = {
  name?: string
  about?: string
  picture?: string
  nip05?: string
}

// A queued write. Seeding is ordered — a reply's parent has to exist first — so every write goes
// through the scenario's queue rather than starting when it is declared.
export type Enqueue = (write: () => Promise<void>) => void

// A user's membership as their own client sees it, which the scenario turns into one room list
// per user once every space has been seeded.
export type SeededMembership = {
  user: TestUser
  rooms: string[]
}

export type SeededSpace = {
  readonly name: TenantName
  // The url is read off the relay handle, so this only reads once seeding has run.
  readonly url: string
  readonly memberships: SeededMembership[]
  room(h: string, options?: RoomOptions): void
  member(user: TestUser, h?: string): void
  // Relay and room membership, plus a place in the user's own room list — what a user who joined
  // this space through the ui would end up with.
  join(user: TestUser, ...rooms: string[]): void
  message(user: TestUser, h: string, content: string, createdAt?: number): SeededEvent
  reply(user: TestUser, parent: SeededEvent, content: string, createdAt?: number): SeededEvent
  profile(user: TestUser, values: ProfileValues, createdAt?: number): SeededEvent
  event(user: TestUser, template: StampedEvent): SeededEvent
}

export type SeedSpaceOptions = {
  zooid: Zooid
  enqueue: Enqueue
  // The moment the scenario began. A fixture declared without a timestamp is stamped with it
  // rather than with the wall clock, so a run's events never drift apart from one another.
  startedAt: number
  name: TenantName
}

export const seedSpace = ({zooid, enqueue, startedAt, name}: SeedSpaceOptions): SeededSpace => {
  const memberships: SeededMembership[] = []

  let testRelay: Maybe<TestRelay>

  const relay = () => {
    if (testRelay) return testRelay

    throw new Error(`Space "${name}" has not been seeded yet, await seed() first`)
  }

  enqueue(async () => {
    testRelay = await zooid.relay(name)
  })

  // Every fixture is published to this space, so a relay hint always resolves to its url.
  const context = {resolver: new Resolver(() => [relay().url])}

  const publish = (write: () => Promise<SignedEvent>): SeededEvent => {
    let signed: Maybe<SignedEvent>

    const event = () => {
      if (signed) return signed

      throw new Error(`An event seeded into "${name}" was read before seed() published it`)
    }

    enqueue(async () => {
      signed = await write()
    })

    return {
      get event() {
        return event()
      },
      get id() {
        return event().id
      },
    }
  }

  const publishTemplate = (user: TestUser, build: () => MaybeAsync<StampedEvent>) =>
    publish(async () => relay().event(user, await build()))

  const room = (h: string, roomOptions: RoomOptions = {}) =>
    enqueue(() => relay().room(h, roomOptions, startedAt))

  const member = (user: TestUser, h?: string) => enqueue(() => relay().member(user, h, startedAt))

  const event = (user: TestUser, template: StampedEvent) => publishTemplate(user, () => template)

  const join = (user: TestUser, ...roomIds: string[]) => {
    memberships.push({user, rooms: roomIds})
    member(user)

    for (const h of roomIds) {
      event(
        users.admin,
        makeEvent(ROOM_ADD_MEMBER, {
          created_at: startedAt,
          tags: [
            ["h", h],
            ["p", user.pubkey],
          ],
        }),
      )
    }
  }

  const message = (user: TestUser, h: string, content: string, createdAt = startedAt) =>
    publish(() => relay().message(user, h, content, createdAt))

  // Flotilla replies in a room by quoting: Content.svelte renders a quote from the nostr uri in the
  // content rather than from the q tag, so the uri has to be prepended, as prependParent does in
  // src/app/rooms.ts.
  const reply = (user: TestUser, parent: SeededEvent, content: string, createdAt = startedAt) =>
    publishTemplate(user, async () => {
      const h = tagValue(tagSpec("h"), parent.event.tags)

      if (h) {
        const url = relay().url
        const nevent = neventEncode({...parent.event, relays: [url]})
        const template = await new MessageWriter(MESSAGE, context)
          .setRoom(url, h)
          .addQuote(parent.event)
          .addMention(parent.event.pubkey)
          .setContent(toNostrURI(nevent) + "\n\n" + content)
          .renderTemplate()

        return {...template, created_at: createdAt}
      }

      throw new Error(`Cannot reply to ${parent.id}, it is not in a room`)
    })

  const profile = (user: TestUser, values: ProfileValues, createdAt = startedAt) =>
    publishTemplate(user, async () => ({
      ...(await Profile.configure(context).writer().update(values).renderTemplate()),
      created_at: createdAt,
    }))

  return {
    name,
    get url() {
      return relay().url
    },
    memberships,
    room,
    member,
    join,
    message,
    reply,
    profile,
    event,
  }
}
