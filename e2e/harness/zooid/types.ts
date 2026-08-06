import type {SignedEvent, StampedEvent} from "@welshman/util"
import type {ClientMessage, RelayMessage} from "@welshman/net"
import type {TestUser} from "../keys"

export type RoomOptions = {
  name?: string
  about?: string
  picture?: string
  closed?: boolean
  private?: boolean
}

// A handle to one relay, plus the seeding affordances scenarios build on. Every seeding call
// publishes over a real socket rather than inserting into storage, so the relay stores exactly what
// it would have stored for a real client. Each one is stamped by its caller rather than off the
// wall clock, so a scenario's fixtures share one clock.
export type TestRelay = {
  readonly name: string
  readonly url: string
  room(h: string, options: RoomOptions, createdAt: number): Promise<void>
  message(user: TestUser, h: string, content: string, createdAt: number): Promise<SignedEvent>
  // Grants relay membership, and room membership too when `h` is given.
  member(user: TestUser, h: string | undefined, createdAt: number): Promise<void>
  // Escape hatch for kinds with no affordance of their own: profiles, reactions, threads, DMs.
  event(user: TestUser, event: StampedEvent): Promise<SignedEvent>
}

// One client's connection to a relay. Every connection to a url reaches the same container, which
// is what lets one browser context observe another's writes over the wire.
export type RelayConnection = {
  onMessage(listener: (message: RelayMessage) => void): void
  send(message: ClientMessage): void
  close(): void
}
