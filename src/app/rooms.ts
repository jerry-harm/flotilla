import * as nip19 from "nostr-tools/nip19"
import {derived} from "svelte/store"
import {sortBy, uniq} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {
  MESSAGE,
  ROOM_ADD_MEMBER,
  ROOM_JOIN,
  ROOM_LEAVE,
  ROOM_REMOVE_MEMBER,
  makeEvent,
  outbox,
  seen,
  sortEventsAsc,
  toNostrURI,
} from "@welshman/util"
import type {EventContent, TrustedEvent} from "@welshman/util"
import {RoomLists, makeRoomKey, createSearch} from "@welshman/app"
import type {Room, RoomMeta} from "@welshman/app"
import {
  deriveUserItem,
  relayManagement,
  relayMemberLists,
  roomLists,
  rooms,
  router,
  thunks,
  relays,
  user,
} from "@app/core"
import {deriveUserIsSpaceAdmin} from "@app/management"
import {deriveEventsForUrl} from "@app/repository"
import {makeRoomPath} from "@app/routes"

export enum MembershipStatus {
  Initial,
  Pending,
  Granted,
}

export const ROOM = "h"

export const PROTECTED = ["-"]

export enum RoomType {
  Text = "text",
  Voice = "voice",
}

export const getRoomType = (room: Maybe<Room>) =>
  room?.meta?.hasLivekit() ? RoomType.Voice : RoomType.Text

export const isRoomId = (id: string) => id.includes("'")

export const displayRoom = (url: string, h: string) =>
  rooms.get().get(makeRoomKey(url, h))?.meta?.name() || h

export const roomComparator = (url: string) => (h: string) => displayRoom(url, h).toLowerCase()

export const deriveRoomMembers = (url: string, h: string) =>
  derived(rooms.get().forRoom(url, h), $room => $room?.members?.members() ?? [])

// A room member also has to be allowed at the relay level, or they won't be able to read the
// room at all.
export const addRoomMembers = async (url: string, room: RoomMeta, pubkeys: string[]) => {
  const members = relayMemberLists.get().get(url)
  const management = relayManagement.get().forUrl(url)

  const responses = await Promise.all(
    pubkeys.filter(pk => !members?.isMember(pk)).map(pk => management.allowPubkey(pk)),
  )

  for (const {error} of responses) {
    if (error) {
      return error
    }
  }

  const errors = await Promise.all(
    pubkeys.map(pk =>
      rooms
        .get()
        .addMember(url, room, pk)
        .then(command => command.publish().waitForError()),
    ),
  )

  for (const error of errors) {
    if (error) {
      return error
    }
  }
}

export const prependParent = async (
  parent: Maybe<TrustedEvent>,
  {content, tags}: EventContent,
  url?: string,
): Promise<EventContent> => {
  if (parent) {
    const resolver = router.get().resolver
    const relays = url ? [url] : await resolver.relays([seen(parent)])
    const hint = url ?? (await resolver.relay([outbox(parent.pubkey)])) ?? ""
    const nevent = nip19.neventEncode({...parent, relays})

    content = toNostrURI(nevent) + "\n\n" + content
    tags = [...tags, ["q", parent.id, hint, parent.pubkey], ["p", parent.pubkey, hint]]
  }

  return {content, tags}
}

export const publishRoomQuote = async ({
  url,
  h,
  parent,
  protect,
  delay,
}: {
  url: string
  h?: string
  parent: TrustedEvent
  protect: boolean
  delay?: number
}) => {
  const tags: string[][] = []

  if (h) {
    tags.push([ROOM, h])
  }

  if (protect) {
    tags.push(PROTECTED)
  }

  const event = makeEvent(MESSAGE, await prependParent(parent, {content: "", tags}, url))

  return thunks.get().publish({relays: [url], event, delay})
}

// User

export const userRoomList = deriveUserItem(RoomLists)

export const userSpaceUrls = derived(userRoomList, $userRoomList => $userRoomList?.urls() ?? [])

// Rooms in the space the user has joined, limited to those the relay still advertises.
export const deriveUserRooms = (url: string) =>
  derived(
    [roomLists.get().roomsForUrl(user.get().pubkey, url).$, rooms.get().forUrl(url).$],
    ([$rooms, $spaceRooms]) => {
      const known = new Set($spaceRooms.map(room => room.h))

      return sortBy(roomComparator(url), uniq($rooms.filter(h => known.has(h))))
    },
  )

export const deriveOtherRooms = (url: string) =>
  derived([deriveUserRooms(url), rooms.get().forUrl(url).$], ([$userRooms, $spaceRooms]) => {
    const result = $spaceRooms
      .filter(room => !room.meta?.hasLivekit() && !$userRooms.includes(room.h))
      .map(room => room.h)

    return sortBy(roomComparator(url), uniq(result))
  })

export const deriveOtherVoiceRooms = (url: string) =>
  derived([deriveUserRooms(url), rooms.get().forUrl(url).$], ([$userRooms, $spaceRooms]) => {
    const result = $spaceRooms
      .filter(room => room.meta?.hasLivekit() && !$userRooms.includes(room.h))
      .map(room => room.h)

    return sortBy(roomComparator(url), uniq(result))
  })

// A space admin administers every room in it, so space admin implies room admin.
export const deriveUserIsRoomAdmin = (url: string, h: string) =>
  derived(
    [user, rooms.get().forRoom(url, h), deriveUserIsSpaceAdmin(url)],
    ([$user, $room, $isSpaceAdmin]) =>
      $isSpaceAdmin || Boolean($room?.admins?.pubkeys().includes($user.pubkey)),
  )

export const deriveUserRoomMembershipStatus = (url: string, h: string) =>
  derived(
    [
      user,
      rooms.get().forRoom(url, h),
      deriveEventsForUrl(url, [{kinds: [ROOM_ADD_MEMBER, ROOM_REMOVE_MEMBER], "#h": [h]}]),
      deriveEventsForUrl(url, [{kinds: [ROOM_JOIN, ROOM_LEAVE], "#h": [h]}]),
      deriveUserIsRoomAdmin(url, h),
    ],
    ([$user, $room, $addRemoveEvents, $joinLeaveEvents, $isAdmin]) => {
      if ($isAdmin) {
        return MembershipStatus.Granted
      }

      let isMember = false

      if ($room?.members) {
        isMember = $room.members.isMember($user.pubkey)
      } else {
        for (const event of sortEventsAsc($addRemoveEvents)) {
          if (event.pubkey === $user.pubkey) {
            isMember = event.kind === ROOM_ADD_MEMBER
          }
        }
      }

      for (const event of $joinLeaveEvents) {
        if (event.pubkey === $user.pubkey) {
          if (event.kind === ROOM_JOIN) {
            return isMember ? MembershipStatus.Granted : MembershipStatus.Pending
          }

          return MembershipStatus.Initial
        }
      }

      return isMember ? MembershipStatus.Granted : MembershipStatus.Initial
    },
  )

export const deriveUserRoomSearch = () =>
  derived(
    [userSpaceUrls, userRoomList, rooms.get().byUrl.$],
    ([$userSpaceUrls, $userRoomList, $roomsByUrl]) => {
      const options = $userSpaceUrls.flatMap(url => {
        const favorites = new Set($userRoomList?.roomsForUrl(url) ?? [])
        // Spaces that aren't NIP-29 relays keep all their messages in the space-wide chat
        const roomIds = relays.get().get(url)?.hasNip(29)
          ? ($roomsByUrl.get(url) ?? []).map(room => room.h)
          : ["chat"]

        return roomIds.map(h => ({
          url,
          h,
          name: displayRoom(url, h),
          isFavorite: favorites.has(h),
        }))
      })

      return createSearch(options, {
        getValue: option => makeRoomPath(option.url, option.h),
        fuseOptions: {keys: ["name", "url"]},
        sortFn: ({item}) => (item.isFavorite ? 0 : 1),
      })
    },
  )
