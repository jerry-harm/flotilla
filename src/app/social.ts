import {derived} from "svelte/store"
import {shuffle} from "@welshman/lib"
import {
  COMMENT,
  addressTags,
  getAddress,
  hexTags,
  tagSpec,
  tagValues,
  topicTags,
} from "@welshman/util"
import type {TrustedEvent} from "@welshman/util"
import {withGetter} from "@welshman/store"
import {getCommentTagValues, getReplyTagValues} from "@welshman/domain"
import {FollowLists, MuteLists} from "@welshman/app"
import {deriveUserItem, profiles, user} from "@app/core"
import {DEFAULT_PUBKEYS} from "@app/env"

export const bootstrapPubkeys = derived(deriveUserItem(FollowLists), $userFollowList => {
  const appPubkeys = DEFAULT_PUBKEYS.split(",")
  const userPubkeys = shuffle($userFollowList?.pubkeys() ?? [])

  return userPubkeys.length > 5 ? userPubkeys : [...userPubkeys, ...appPubkeys]
})

// Ids and addresses of an event's immediate parents, falling back to its thread roots.
const getParents = ({kind, tags}: TrustedEvent) => {
  const {roots, replies} = kind === COMMENT ? getCommentTagValues(tags) : getReplyTagValues(tags)

  return replies.length > 0 ? replies : roots
}

export const isEventMuted = withGetter(
  derived([user, deriveUserItem(MuteLists)], ([$user, $muteList]) => {
    const tags = $muteList?.tags() ?? []
    const mutedEvents = new Set(tagValues(hexTags("e"), tags))
    const mutedPubkeys = new Set(tagValues(hexTags("p"), tags))
    const mutedAddresses = new Set(tagValues(addressTags("a"), tags))
    const mutedTopics = new Set(tagValues(topicTags("t"), tags))
    const mutedWords = tagValues(tagSpec("word"), tags)
    const regex =
      mutedWords.length > 0
        ? new RegExp(`\\b(${mutedWords.map(w => w.toLowerCase().trim()).join("|")})\\b`)
        : undefined

    return (e: TrustedEvent) => {
      if (!$muteList) return false
      if ($user.pubkey === e.pubkey) return false
      if (mutedPubkeys.has(e.pubkey)) return true
      if (mutedEvents.has(e.id)) return true
      if (mutedAddresses.has(getAddress(e))) return true
      if (getParents(e).some(v => mutedEvents.has(v) || mutedAddresses.has(v))) return true
      if (tagValues(topicTags("t"), e.tags).some(t => mutedTopics.has(t))) return true

      if (regex) {
        const profile = profiles.get().get(e.pubkey)

        if (profile?.display().toLowerCase().match(regex)) return true
        if (profile?.nip05()?.match(regex)) return true
      }

      return false
    }
  }),
)
