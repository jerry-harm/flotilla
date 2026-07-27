import {derived, readable, writable} from "svelte/store"
import {
  ManagementMethod,
  RELAY_ADD_MEMBER,
  RELAY_JOIN,
  RELAY_LEAVE,
  RELAY_MEMBERS,
  RELAY_REMOVE_MEMBER,
  ROOM_ADD_MEMBER,
  ROOM_ADMINS,
  ROOM_CREATE_PERMISSION,
  ROOM_JOIN,
  ROOM_LEAVE,
  ROOM_MEMBERS,
  ROOM_REMOVE_MEMBER,
  getPubkeyTagValues,
  getTags,
  getTagValue,
  getTagValues,
  sortEventsAsc,
} from "@welshman/util"
import type {Filter, ManagementRequest, PublishedRoomMeta, TrustedEvent} from "@welshman/util"
import {first, simpleCache, sortBy, spec, uniq} from "@welshman/lib"
import {addRoomMember, manageRelay, pubkey, waitForThunkError} from "@welshman/app"
import {load} from "@welshman/net"
import {get} from "svelte/store"
import {deriveEventsForUrl, deriveRelaySignedEvents} from "@app/repository"

export const deriveSpaceMembers = (url: string) =>
  derived(deriveRelaySignedEvents(url, [{kinds: [RELAY_MEMBERS]}]), ([event]) =>
    uniq(getTagValues("member", event?.tags ?? [])),
  )

export const RELAY_ROLE = 33534

export type SpaceRole = {
  id: string
  label: string
  description: string
  color: number // hue, 0 to 360
  order: number
}

// Defaults for the components the client supplies, chosen to read on both themes.
const DEFAULT_SATURATION = 0.7
const DEFAULT_LIGHTNESS = 0.5

// Parse the hue from a ["color", hue] tag, falling back to 0.
export const parseRoleColor = (tags: string[][]): number => {
  const hue = parseFloat(getTagValue("color", tags) ?? "")

  return isNaN(hue) ? 0 : hue
}

// Build an hsl() string from a role's hue, using our default saturation and lightness.
export const roleColor = (hue: number) =>
  `hsl(${hue}, ${DEFAULT_SATURATION * 100}%, ${DEFAULT_LIGHTNESS * 100}%)`

// A translucent tint of the role color for use as a background fill.
export const roleColorSoft = (hue: number) =>
  `hsl(${hue}, ${DEFAULT_SATURATION * 100}%, ${DEFAULT_LIGHTNESS * 100}%, 0.15)`

export const deriveSpaceRoles = (url: string) =>
  derived(deriveRelaySignedEvents(url, [{kinds: [RELAY_ROLE]}]), $events => {
    const roles: SpaceRole[] = []

    for (const event of $events) {
      const id = getTagValue("d", event.tags)

      if (id) {
        roles.push({
          id,
          label: getTagValue("label", event.tags) ?? "",
          description: getTagValue("description", event.tags) ?? "",
          color: parseRoleColor(event.tags),
          order: Math.max(1, parseInt(getTagValue("order", event.tags) ?? "1", 10) || 1),
        })
      }
    }

    return sortBy(r => [r.order, r.label] as [number, string], roles)
  })

// Map<pubkey, roleId[]> parsed from EXTRA values on ["member", pubkey, ...roleIds] tags
export const deriveSpaceMemberRoles = (url: string) =>
  derived(deriveRelaySignedEvents(url, [{kinds: [RELAY_MEMBERS]}]), ([event]) => {
    const memberRoles = new Map<string, string[]>()

    if (event) {
      for (const tag of getTags("member", event.tags)) {
        const pubkey = tag[1]
        const roleIds = tag.slice(2)

        if (pubkey) {
          memberRoles.set(pubkey, roleIds)
        }
      }
    }

    return memberRoles
  })

// Pull the relay's freshly-signed role event so the UI reflects the change immediately,
// rather than waiting for the live subscription to catch up.
const reloadRole = (url: string, id: string) =>
  load({relays: [url], filters: [{kinds: [RELAY_ROLE], "#d": [id]}]})

// Roles extend NIP-86: these methods aren't in welshman's ManagementMethod, and hue and
// order go over the wire as JSON numbers, not strings, per the relay's implementation.
const manageRole = (url: string, method: string, params: (string | number)[]) =>
  manageRelay(url, {method, params} as ManagementRequest)

export const createRole = async (
  url: string,
  id: string,
  label: string,
  description: string,
  color: number,
  order: number,
): Promise<string | undefined> => {
  const {error} = await manageRole(url, "createrole", [id, label, description, color, order])

  if (!error) {
    await reloadRole(url, id)
  }

  return error
}

export const editRole = async (
  url: string,
  id: string,
  label: string,
  description: string,
  color: number,
  order: number,
): Promise<string | undefined> => {
  const {error} = await manageRole(url, "editrole", [id, label, description, color, order])

  if (!error) {
    await reloadRole(url, id)
  }

  return error
}

export const deleteRole = async (url: string, id: string): Promise<string | undefined> => {
  const {error} = await manageRole(url, "deleterole", [id])

  return error
}

export const assignRole = async (
  url: string,
  pubkey: string,
  roleId: string,
): Promise<string | undefined> => {
  const {error} = await manageRole(url, "assignrole", [pubkey, roleId])

  return error
}

export const unassignRole = async (
  url: string,
  pubkey: string,
  roleId: string,
): Promise<string | undefined> => {
  const {error} = await manageRole(url, "unassignrole", [pubkey, roleId])

  return error
}

export const deriveRoomMembers = (url: string, h: string) => {
  const filters: Filter[] = [{kinds: [ROOM_MEMBERS], "#d": [h]}]

  return derived(deriveEventsForUrl(url, filters), ([event]) =>
    uniq(getPubkeyTagValues(event?.tags ?? [])),
  )
}

export type BannedPubkeyItem = {
  pubkey: string
  reason: string
}

export const spaceBannedPubkeyItems = new Map<string, BannedPubkeyItem[]>()

export const deriveSpaceBannedPubkeyItems = (url: string) => {
  const store = writable(spaceBannedPubkeyItems.get(url) || [])

  manageRelay(url, {method: ManagementMethod.ListBannedPubkeys, params: []}).then(res => {
    spaceBannedPubkeyItems.set(url, res.result)
    store.set(res.result)
  })

  return store
}

export const deriveRoomAdmins = (url: string, h: string) => {
  const filters: Filter[] = [{kinds: [ROOM_ADMINS], "#d": [h]}]

  return derived(deriveEventsForUrl(url, filters), $events => {
    const adminsEvent = first($events)

    if (adminsEvent) {
      return getPubkeyTagValues(adminsEvent.tags)
    }

    return []
  })
}

export const getRoomMembers = (_url: string, h: string, events: TrustedEvent[]) => {
  const members = new Set<string>()

  for (const event of sortEventsAsc(events)) {
    if (event.kind === ROOM_MEMBERS && getTagValue("d", event.tags) === h) {
      members.clear()

      for (const pubkey of uniq(getPubkeyTagValues(event.tags))) {
        members.add(pubkey)
      }

      continue
    }

    if (getTagValue("h", event.tags) !== h) {
      continue
    }

    const pubkeys = getPubkeyTagValues(event.tags)

    if (event.kind === ROOM_ADD_MEMBER) {
      for (const pubkey of pubkeys) {
        members.add(pubkey)
      }
    }

    if (event.kind === ROOM_REMOVE_MEMBER) {
      for (const pubkey of pubkeys) {
        members.delete(pubkey)
      }
    }
  }

  return Array.from(members)
}

// User membership status

export enum MembershipStatus {
  Initial,
  Pending,
  Granted,
}

// This costs a signature and an http round trip, so share one store per url and only
// re-check when the answer has had time to go stale (or when a check failed).
export const deriveUserIsSpaceAdmin = simpleCache(([url]: [string | undefined]) => {
  let checkedAt = 0

  return readable(false, set => {
    if (url && checkedAt < Date.now() - 300_000) {
      checkedAt = Date.now()

      manageRelay(url, {method: ManagementMethod.SupportedMethods, params: []})
        .then(({result}) => set(Boolean(result?.length)))
        .catch(error => {
          checkedAt = 0
          console.error(error)
        })
    }
  })
})

export const deriveUserSpaceMembershipStatus = (url: string) => {
  // Fetch member list and user add/remove events directly in this derivation.
  const memberListFilters: Filter[] = [{kinds: [RELAY_MEMBERS]}]
  const userEventFilters: Filter[] = [{kinds: [RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER]}]

  return derived(
    [
      pubkey,
      deriveRelaySignedEvents(url, memberListFilters),
      deriveRelaySignedEvents(url, userEventFilters),
      deriveEventsForUrl(url, [{kinds: [RELAY_JOIN, RELAY_LEAVE]}]),
      deriveUserIsSpaceAdmin(url),
    ],
    ([$pubkey, $memberListEvents, $userAddRemoveEvents, $joinLeaveEvents, $isAdmin]) => {
      // If admin, always granted.
      if ($isAdmin) {
        return MembershipStatus.Granted
      }

      const membersEvent = $memberListEvents.find(spec({kind: RELAY_MEMBERS}))
      const memberList = membersEvent ? uniq(getTagValues("member", membersEvent.tags)) : undefined

      let isMember = false

      if (memberList) {
        // Member list exists - check if user is in it.
        isMember = memberList.includes($pubkey!)
      } else {
        // No member list available - replay the user's add/remove history.
        for (const event of sortBy(e => e.created_at, $userAddRemoveEvents)) {
          if (event.pubkey !== $pubkey) {
            continue
          }

          if (event.kind === RELAY_ADD_MEMBER) {
            isMember = true
          } else if (event.kind === RELAY_REMOVE_MEMBER) {
            isMember = false
          }
        }
      }

      for (const event of $joinLeaveEvents) {
        // Join events indicate pending or granted status, leave resets to initial.
        if (event.pubkey !== $pubkey) {
          continue
        }

        if (event.kind === RELAY_JOIN) {
          return isMember ? MembershipStatus.Granted : MembershipStatus.Pending
        }

        if (event.kind === RELAY_LEAVE) {
          return MembershipStatus.Initial
        }
      }

      return isMember ? MembershipStatus.Granted : MembershipStatus.Initial
    },
  )
}

export const deriveUserIsRoomAdmin = (url: string, h: string) =>
  derived(
    [pubkey, deriveRoomAdmins(url, h), deriveUserIsSpaceAdmin(url)],
    ([$pubkey, $admins, $isSpaceAdmin]) => $isSpaceAdmin || $admins.includes($pubkey!),
  )

export const deriveUserRoomMembershipStatus = (url: string, h: string) => {
  // Fetch the room member list and the current user's add/remove events.
  const userEventFilters: Filter[] = [{kinds: [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER], "#h": [h]}]
  const joinLeaveFilters: Filter[] = [{kinds: [ROOM_JOIN, ROOM_LEAVE], "#h": [h]}]

  return derived(
    [
      pubkey,
      deriveRoomMembers(url, h),
      deriveEventsForUrl(url, userEventFilters),
      deriveEventsForUrl(url, joinLeaveFilters),
      deriveUserIsRoomAdmin(url, h),
    ],
    ([$pubkey, $memberList, $userAddRemoveEvents, $joinLeaveEvents, $isAdmin]) => {
      // If admin of this room's space, always granted.
      if ($isAdmin) {
        return MembershipStatus.Granted
      }

      let isMember = false

      if ($memberList) {
        // Member list exists - check if user is in it.
        isMember = $memberList.includes($pubkey!)
      } else {
        // No member list available - replay the user's add/remove history.
        for (const event of sortEventsAsc($userAddRemoveEvents)) {
          if (event.pubkey !== $pubkey) {
            continue
          }

          if (event.kind === ROOM_ADD_MEMBER) {
            isMember = true
          } else if (event.kind === ROOM_REMOVE_MEMBER) {
            isMember = false
          }
        }
      }

      for (const event of $joinLeaveEvents) {
        // Join events indicate pending or granted status, leave resets to initial.
        if (event.pubkey !== $pubkey) {
          continue
        }

        if (event.kind === ROOM_JOIN) {
          return isMember ? MembershipStatus.Granted : MembershipStatus.Pending
        }

        if (event.kind === ROOM_LEAVE) {
          return MembershipStatus.Initial
        }
      }

      return isMember ? MembershipStatus.Granted : MembershipStatus.Initial
    },
  )
}

export const deriveUserCanCreateRoom = (url: string) => {
  const filters: Filter[] = [{kinds: [ROOM_CREATE_PERMISSION]}]

  return derived(
    [pubkey, deriveEventsForUrl(url, filters), deriveUserIsSpaceAdmin(url)],
    ([$pubkey, $events, $isAdmin]) => {
      for (const event of $events) {
        if (getPubkeyTagValues(event.tags).includes($pubkey!)) {
          return true
        }
      }

      return $isAdmin
    },
  )
}

export const addSpaceMembers = async (
  url: string,
  pubkeys: string[],
): Promise<string | undefined> => {
  const spaceMembers = get(deriveSpaceMembers(url))

  const results = await Promise.all(
    pubkeys
      .filter(pubkey => !spaceMembers || !spaceMembers.includes(pubkey))
      .map(pubkey =>
        manageRelay(url, {
          method: ManagementMethod.AllowPubkey,
          params: [pubkey],
        }),
      ),
  )

  for (const {error} of results) {
    if (error) {
      return error
    }
  }
}

export const removeSpaceMembers = async (
  url: string,
  pubkeys: string[],
): Promise<string | undefined> => {
  const results = await Promise.all(
    pubkeys.map(pubkey =>
      manageRelay(url, {
        method: ManagementMethod.UnallowPubkey,
        params: [pubkey],
      }),
    ),
  )

  for (const {error} of results) {
    if (error) {
      return error
    }
  }
}

export const banSpaceMembers = async (
  url: string,
  pubkeys: string[],
  reason = "",
): Promise<string | undefined> => {
  const results = await Promise.all(
    pubkeys.map(pubkey =>
      manageRelay(url, {
        method: ManagementMethod.BanPubkey,
        params: reason ? [pubkey, reason] : [pubkey],
      }),
    ),
  )

  for (const {error} of results) {
    if (error) {
      return error
    }
  }
}

export const addRoomMembers = async (
  url: string,
  room: PublishedRoomMeta,
  pubkeys: string[],
): Promise<string | undefined> => {
  const error = await addSpaceMembers(url, pubkeys)

  if (error) {
    return error
  }

  const errors = await Promise.all(
    pubkeys.map(pubkey => waitForThunkError(addRoomMember(url, room, pubkey))),
  )

  for (const error of errors) {
    if (error) {
      return error
    }
  }
}
