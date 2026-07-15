import {derived} from "svelte/store"
import type {Readable} from "svelte/store"
import {makeEvent, getTagValues} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {publishThunk, waitForThunkError} from "@welshman/app"
import {load} from "@welshman/net"
import {deriveEventsForUrl, deriveLatestEventForUrl} from "@app/repository"
import {PROTECTED} from "@app/groups"
import {canEnforceNip70} from "@app/relays"

// NIP-29 proposed pin list kinds (see https://github.com/nostr-protocol/nips/pull/2379)
export const ROOM_PINS = 39005
export const ROOM_UPDATE_PIN_LIST = 9010

const pinListFilters = (h: string) => [{kinds: [ROOM_PINS], "#d": [h]}]

export const deriveRoomPinIds = (url: string, h: string) =>
  derived(deriveLatestEventForUrl(url, pinListFilters(h)), event =>
    getTagValues("e", event?.tags ?? []),
  )

export const deriveRoomPinnedEvents = (
  url: string,
  pinIds: Readable<string[]>,
): Readable<TrustedEvent[]> =>
  derived(pinIds, ($pinIds, set) => {
    if ($pinIds.length === 0) {
      set([] as TrustedEvent[])

      return () => {}
    }

    const events = deriveEventsForUrl(url, [{ids: $pinIds}])

    const unsub = events.subscribe($events => {
      const byId = new Map($events.map(event => [event.id, event]))

      set(
        $pinIds.flatMap(id => {
          const event = byId.get(id)

          return event ? [event] : []
        }),
      )
    })

    return () => unsub()
  })

export const loadRoomPinList = (url: string, h: string, signal?: AbortSignal) =>
  load({relays: [url], signal, filters: pinListFilters(h)})

export const loadRoomPinnedMessages = (url: string, ids: string[], signal?: AbortSignal) => {
  if (ids.length === 0) {
    return
  }

  return load({relays: [url], signal, filters: [{ids}]})
}

export const updateRoomPins = async (url: string, h: string, eventIds: string[]) => {
  const tags: string[][] = [["h", h], ...eventIds.map(id => ["e", id])]

  if (await canEnforceNip70(url)) {
    tags.push(PROTECTED)
  }

  const event = makeEvent(ROOM_UPDATE_PIN_LIST, {
    content: "",
    tags,
  })

  return waitForThunkError(publishThunk({relays: [url], event}))
}

export const pinRoomMessage = async (
  url: string,
  h: string,
  eventId: string,
  currentIds: string[],
) => {
  if (currentIds.includes(eventId)) {
    return undefined
  }

  return updateRoomPins(url, h, [...currentIds, eventId])
}

export const unpinRoomMessage = async (
  url: string,
  h: string,
  eventId: string,
  currentIds: string[],
) =>
  updateRoomPins(
    url,
    h,
    currentIds.filter(id => id !== eventId),
  )
