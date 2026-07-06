import {derived} from "svelte/store"
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
  readList,
  sortEventsDesc,
} from "@welshman/util"
import type {ManagementMethod, TrustedEvent} from "@welshman/util"
import {manageRelay} from "@welshman/app"
import {deriveEventsForUrl, deriveRelaySignedEvents} from "@app/repository"

export const BOARD = 30067

export const PIN = 39067

export type Board = {
  address: string
  identifier: string
  title: string
  description: string
  image: string
  topics: string[]
  collaborative: boolean
}

export type Pin = {
  id: string
  pubkey: string
  identifier: string
  boards: string[]
  description: string
  title: string
  topics: string[]
  // The pin's content reference: the first e/a/i tag found, e.g. ["e", <id>],
  // ["a", <coord>], or ["i", <external id>]. Empty when the pin has no reference.
  value: string[]
}

export const readBoard = (event: TrustedEvent): Board => {
  const tags = getListTags(readList(asDecryptedEvent(event)))

  return {
    address: getAddress(event),
    identifier: getTagValue("d", tags) ?? "",
    title: getTagValue("title", tags) ?? "",
    description: getTagValue("description", tags) ?? "",
    image: getTagValue("image", tags) ?? "",
    topics: getTagValues("t", tags),
    collaborative: tags.some(tag => tag[0] === "collaborative"),
  }
}

export const readPin = (event: TrustedEvent): Pin => ({
  id: event.id,
  pubkey: event.pubkey,
  identifier: getTagValue("d", event.tags) ?? "",
  boards: getTagValues("A", event.tags),
  description: event.content,
  title: getTagValue("title", event.tags) ?? "",
  topics: getTagValues("t", event.tags),
  value: event.tags.find(tag => ["e", "a", "i"].includes(tag[0])) ?? [],
})

export const deriveBoards = (url: string) =>
  derived(deriveEventsForUrl(url, [{kinds: [BOARD]}]), $events => $events.map(readBoard))

export const deriveBoard = (url: string, identifier: string) =>
  derived(deriveRelaySignedEvents(url, [{kinds: [BOARD], "#d": [identifier]}]), ([event]) =>
    event ? readBoard(event) : undefined,
  )

export const deriveBoardByAddress = (url: string, address: string) =>
  deriveBoard(url, Address.from(address).identifier)

export const derivePins = (url: string, address: string) =>
  derived(deriveRelaySignedEvents(url, [{kinds: [PIN], "#A": [address]}]), $events =>
    sortEventsDesc($events).map(readPin),
  )

const signAsRelay = async (url: string, template: object): Promise<string | undefined> => {
  const {error} = await manageRelay(url, {
    method: "signevent" as ManagementMethod,
    params: [template as unknown as string],
  })

  return error
}

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

  if (type === "a") {
    const {kind, pubkey, identifier} = Address.from(data)

    return nip19.naddrEncode({kind, pubkey, identifier, relays})
  }

  return data
}

export const pinToReference = (pin: Pin): string => valueToReference(pin.value)

export const addressToReference = (address: string): string => valueToReference(["a", address])

export const referenceToPin = (reference: string): Partial<Pin> | undefined => {
  const trimmed = reference.trim()

  if (!trimmed) return undefined

  try {
    const decoded = nip19.decode(fromNostrURI(trimmed))

    if (decoded.type === "note") return {value: ["e", decoded.data]}
    if (decoded.type === "nevent") {
      const {id, relays} = decoded.data

      return {value: relays?.[0] ? ["e", id, relays[0]] : ["e", id]}
    }
    if (decoded.type === "naddr") {
      const {kind, pubkey, identifier, relays} = decoded.data
      const coordinate = `${kind}:${pubkey}:${identifier}`

      return {value: relays?.[0] ? ["a", coordinate, relays[0]] : ["a", coordinate]}
    }
  } catch {
    // Not a nostr entity; fall through to external url handling.
  }

  return {value: ["i", trimmed]}
}
