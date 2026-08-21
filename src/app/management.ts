import {derived, readable, writable} from "svelte/store"
import {ago, MINUTE, now, simpleCache} from "@welshman/lib"
import {ROOM_CREATE_PERMISSION, hexTags, tagValues} from "@welshman/util"
import {relayManagement, user} from "@app/core"
import {deriveEventsForUrl} from "@app/repository"

export type BannedPubkeyItem = {
  pubkey: string
  reason: string
}

export const deriveSpaceBannedPubkeyItems = (url: string) => {
  const store = writable<BannedPubkeyItem[]>([])

  relayManagement
    .get()
    .forUrl(url)
    .listBannedPubkeys()
    .then(({result = []}) => store.set(result))

  return store
}

export const deriveSpaceSupportedMethods = simpleCache(([url]: [string | undefined]) => {
  let checkedAt = 0

  return readable<string[]>([], set => {
    if (url && checkedAt < ago(5, MINUTE)) {
      checkedAt = now()

      relayManagement
        .get()
        .forUrl(url)
        .supportedMethods()
        .then(({result = []}) => set(result))
        .catch(error => {
          checkedAt = 0
          console.error(error)
        })
    }
  })
})

// User

// A relay answers supportedmethods with everything it implements rather than with what the
// caller may use, so all this can tell us is that the call wasn't refused outright.
export const deriveUserIsSpaceAdmin = (url?: string) =>
  derived(deriveSpaceSupportedMethods(url), $methods => $methods.length > 0)

export const deriveUserCanCreateRoom = (url: string) =>
  derived(
    [
      user,
      deriveEventsForUrl(url, [{kinds: [ROOM_CREATE_PERMISSION]}]),
      deriveUserIsSpaceAdmin(url),
    ],
    ([$user, $events, $isAdmin]) =>
      $isAdmin || $events.some(event => tagValues(hexTags("p"), event.tags).includes($user.pubkey)),
  )
