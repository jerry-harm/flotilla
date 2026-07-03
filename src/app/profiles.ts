import {get} from "svelte/store"
import {
  FOLLOWS,
  MESSAGING_RELAYS,
  PROFILE,
  RELAYS,
  createProfile,
  editProfile,
  isPublishedProfile,
  isSignedEvent,
  makeEvent,
} from "@welshman/util"
import type {Profile} from "@welshman/util"
import {nthNe} from "@welshman/lib"
import {publishThunk, pubkey, repository} from "@welshman/app"
import {Router} from "@welshman/router"
import {userSpaceUrls} from "@app/groups"

export const broadcastUserData = async (relays: string[]) => {
  const authors = [pubkey.get()!]
  const kinds = [RELAYS, MESSAGING_RELAYS, FOLLOWS, PROFILE]
  const events = repository.query([{kinds, authors}])

  for (const event of events) {
    if (isSignedEvent(event)) {
      await publishThunk({event, relays}).complete
    }
  }
}

export const updateProfile = ({profile}: {profile: Profile}) => {
  const router = Router.get()
  const template = isPublishedProfile(profile) ? editProfile(profile) : createProfile(profile)
  const scenarios = [router.FromRelays(get(userSpaceUrls)), router.FromUser(), router.Index()]

  // Remove protected tag, we used to add it
  template.tags = template.tags.filter(nthNe(0, "-"))

  const event = makeEvent(template.kind, template)
  const relays = router.merge(scenarios).getUrls()

  return publishThunk({event, relays})
}
