import {derived} from "svelte/store"
import {first, groupBy, removeUndefined, spec} from "@welshman/lib"
import {
  REPORT,
  ROOM_ADD_MEMBER,
  ROOM_JOIN,
  ROOM_LEAVE,
  ROOM_MEMBERS,
  ROOM_REMOVE_MEMBER,
  hexTags,
  sortEventsAsc,
  sortEventsDesc,
  tagSpec,
  tagValue,
  tagValues,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {deriveEventsForUrl} from "@app/repository"

// A room's membership replayed in order — each member list is a snapshot that resets
// the set, with add/remove events applied on top.
const getRoomMembers = (events: TrustedEvent[]) => {
  const members = new Set<string>()

  for (const event of sortEventsAsc(events)) {
    const pubkeys = tagValues(hexTags("p"), event.tags)

    if (event.kind === ROOM_MEMBERS) {
      members.clear()
      pubkeys.forEach(pubkey => members.add(pubkey))
    } else if (event.kind === ROOM_ADD_MEMBER) {
      pubkeys.forEach(pubkey => members.add(pubkey))
    } else if (event.kind === ROOM_REMOVE_MEMBER) {
      pubkeys.forEach(pubkey => members.delete(pubkey))
    }
  }

  return members
}

// Action items (admin review queue)

export const deriveSpaceActionItems = (url: string) =>
  derived(
    deriveEventsForUrl(url, [
      {kinds: [REPORT, ROOM_JOIN, ROOM_LEAVE, ROOM_MEMBERS, ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER]},
    ]),
    $events => {
      const getRoomId = (e: TrustedEvent) =>
        tagValue(tagSpec(e.kind === ROOM_MEMBERS ? "d" : "h"), e.tags)
      const reports = $events.filter(spec({kind: REPORT}))
      const pendingJoins: TrustedEvent[] = []

      // Room-level join requests — most recent per pubkey+h
      for (const [h, roomEvents] of groupBy(getRoomId, $events)) {
        if (!h) continue

        const roomJoins: TrustedEvent[] = []
        const roomLeaves: TrustedEvent[] = []
        const roomMembershipEvents: TrustedEvent[] = []

        for (const event of roomEvents) {
          switch (event.kind) {
            case ROOM_JOIN:
              roomJoins.push(event)
              break
            case ROOM_LEAVE:
              roomLeaves.push(event)
              break
            case ROOM_MEMBERS:
            case ROOM_ADD_MEMBER:
            case ROOM_REMOVE_MEMBER:
              roomMembershipEvents.push(event)
              break
          }
        }

        const roomMembers = getRoomMembers(roomMembershipEvents)

        pendingJoins.push(
          ...removeUndefined(
            Array.from(groupBy(e => e.pubkey, roomJoins).values()).map(events =>
              first(sortEventsDesc(events)),
            ),
          ).filter(({pubkey, created_at}) => {
            if (roomMembers.has(pubkey)) return false
            if (
              roomMembershipEvents.some(event => {
                if (event.created_at <= created_at) {
                  return false
                }

                if (event.kind === ROOM_MEMBERS) {
                  return true
                }

                return tagValues(hexTags("p"), event.tags).includes(pubkey)
              })
            ) {
              return false
            }
            if (roomLeaves.some(e => e.pubkey === pubkey && e.created_at > created_at)) return false

            return true
          }),
        )
      }

      return sortEventsDesc([...reports, ...pendingJoins])
    },
  )
