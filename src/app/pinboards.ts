import {derived, readable} from "svelte/store"
import type {Readable} from "svelte/store"
import * as nip19 from "nostr-tools/nip19"
import {now, randomId} from "@welshman/lib"
import {
  Address,
  DELETE,
  asDecryptedEvent,
  fromNostrURI,
  getAddress,
  getListTags,
  getTagValue,
  getTagValues,
  isReplaceableKind,
  readList,
  sortEventsDesc,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {isLink, parse} from "@welshman/content"
import {deriveEventsForUrl, deriveRelaySignedEvents} from "@app/repository"
import {signAsRelay} from "@app/relays"

export const BOARD = 30067

export const PIN = 39067

export type Board = {
  event?: TrustedEvent
  address: string
  identifier: string
  title: string
  description: string
  image: string
  topics: string[]
  collaborative: boolean
}

export type PublishedBoard = Board & {
  event: TrustedEvent
}

export type Pin = {
  event?: TrustedEvent
  id: string
  pubkey: string
  identifier: string
  boards: string[]
  description: string
  title: string
  topics: string[]
  // The pin's content reference: the first e/a/p/i tag found, e.g. ["e", <id>],
  // ["a", <coord>], ["p", <pubkey>], or ["i", <url>]. Empty when the pin has no
  // reference.
  value: string[]
}

export type PublishedPin = Pin & {
  event: TrustedEvent
}

export const readBoard = (event: TrustedEvent): PublishedBoard => {
  const tags = getListTags(readList(asDecryptedEvent(event)))

  return {
    event,
    address: getAddress(event),
    identifier: getTagValue("d", tags) ?? "",
    title: getTagValue("title", tags) ?? "",
    description: getTagValue("description", tags) ?? "",
    image: getTagValue("image", tags) ?? "",
    topics: getTagValues("t", tags),
    collaborative: tags.some(tag => tag[0] === "collaborative"),
  }
}

export const readPin = (event: TrustedEvent): PublishedPin => ({
  event,
  id: event.id,
  pubkey: event.pubkey,
  identifier: getTagValue("d", event.tags) ?? "",
  boards: getTagValues("A", event.tags),
  description: event.content,
  title: getTagValue("title", event.tags) ?? "",
  topics: getTagValues("t", event.tags),
  value: event.tags.find(tag => ["e", "a", "p", "i"].includes(tag[0])) ?? [],
})

export const deriveBoards = (url: string) =>
  derived(deriveEventsForUrl(url, [{kinds: [BOARD]}]), $events => $events.map(readBoard))

export const deriveBoard = (url: string, identifier: string) =>
  derived(deriveRelaySignedEvents(url, [{kinds: [BOARD], "#d": [identifier]}]), ([event]) =>
    event ? readBoard(event) : undefined,
  )

export const deriveBoardByAddress = (
  url: string,
  address: string,
): Readable<PublishedBoard | undefined> =>
  Address.isAddress(address)
    ? deriveBoard(url, Address.from(address).identifier)
    : readable(undefined)

export const derivePins = (url: string, address: string) =>
  derived(deriveRelaySignedEvents(url, [{kinds: [PIN], "#A": [address]}]), $events =>
    sortEventsDesc($events).map(readPin),
  )

const makeBoardTemplate = ({
  identifier,
  title,
  description,
  image,
  topics,
  collaborative,
}: Omit<Board, "address">) => ({
  kind: BOARD,
  created_at: now(),
  content: "",
  tags: [
    ["d", identifier],
    ["title", title],
    ...(description ? [["description", description]] : []),
    ...(image ? [["image", image]] : []),
    ...topics.map(topic => ["t", topic]),
    ...(collaborative ? [["collaborative"]] : []),
  ],
})

const makePinTemplate = ({
  identifier = "",
  boards = [],
  description = "",
  title = "",
  topics = [],
  value = [],
}: Partial<Pin>) => ({
  kind: PIN,
  created_at: now(),
  content: description,
  tags: [
    // Reuse the identifier when editing so the addressable event is replaced;
    // fall back to a random one for new pins.
    ["d", identifier || randomId()],
    ...boards.map(board => ["A", board]),
    ...(value.length ? [value] : []),
    ...(title ? [["title", title]] : []),
    ...topics.map(topic => ["t", topic]),
  ],
})

const makeDeleteTemplate = (tags: string[][]) => ({
  kind: DELETE,
  created_at: now(),
  content: "",
  tags,
})

export const editBoard = (url: string, board: Board) => signAsRelay(url, makeBoardTemplate(board))

export const createPin = (url: string, pin: Partial<Pin>) => signAsRelay(url, makePinTemplate(pin))

export const deletePin = (url: string, id: string) =>
  signAsRelay(
    url,
    makeDeleteTemplate([
      ["e", id],
      ["k", String(PIN)],
    ]),
  )

export const deleteBoard = (url: string, address: string) =>
  signAsRelay(
    url,
    makeDeleteTemplate([
      ["a", address],
      ["k", String(BOARD)],
    ]),
  )

const valueToReference = (value: string[]): string => {
  const [type, data = "", relay] = value
  const relays = relay ? [relay] : []

  if (type === "e") return nip19.neventEncode({id: data, relays})

  if (type === "p") return nip19.nprofileEncode({pubkey: data, relays})

  if (type === "a") {
    const {kind, pubkey, identifier} = Address.from(data)

    return nip19.naddrEncode({kind, pubkey, identifier, relays})
  }

  return data
}

export const pinToReference = (pin: Pin): string => valueToReference(pin.value)

export const eventToReference = (event: TrustedEvent): string =>
  valueToReference(isReplaceableKind(event.kind) ? ["a", getAddress(event)] : ["e", event.id])

export const referenceToPin = (reference: string): Partial<Pin> | undefined => {
  const trimmed = reference.trim()

  try {
    const decoded = nip19.decode(fromNostrURI(trimmed))

    if (decoded.type === "note") return {value: ["e", decoded.data]}
    if (decoded.type === "npub") return {value: ["p", decoded.data]}
    if (decoded.type === "nevent") {
      const {id, relays} = decoded.data

      return {value: relays?.[0] ? ["e", id, relays[0]] : ["e", id]}
    }
    if (decoded.type === "nprofile") {
      const {pubkey, relays} = decoded.data

      return {value: relays?.[0] ? ["p", pubkey, relays[0]] : ["p", pubkey]}
    }
    if (decoded.type === "naddr") {
      const {kind, pubkey, identifier, relays} = decoded.data
      const coordinate = `${kind}:${pubkey}:${identifier}`

      return {value: relays?.[0] ? ["a", coordinate, relays[0]] : ["a", coordinate]}
    }

    return undefined
  } catch {
    // Not a nostr entity; fall through to external url handling.
  }

  const parsed = parse({content: trimmed})

  return parsed.length === 1 && isLink(parsed[0]) ? {value: ["i", trimmed]} : undefined
}
