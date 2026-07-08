import {derived} from "svelte/store"
import {now} from "@welshman/lib"
import {APP_DATA, getTagValues} from "@welshman/util"
import {deriveRelaySignedEvents} from "@app/repository"
import {signAsRelay} from "@app/relays"

// NIP-78 app data published by the relay's self key. Each featured entry is a
// ["content", <value>] tag (freeform text, intended to be a url or nevent).
export const FEATURED_CONTENT_D = "flotilla/featured-content"

export const deriveFeaturedContent = (url: string) =>
  derived(
    deriveRelaySignedEvents(url, [{kinds: [APP_DATA], "#d": [FEATURED_CONTENT_D]}]),
    ([event]) => getTagValues("content", event?.tags ?? []),
  )

// Publish the featured content list by asking the relay to sign it with its self
// key (the unofficial NIP-86 "signevent" method).
export const setFeaturedContent = (url: string, content: string[]): Promise<string | undefined> =>
  signAsRelay(url, {
    kind: APP_DATA,
    created_at: now(),
    content: "",
    tags: [
      ["d", FEATURED_CONTENT_D],
      ...content
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => ["content", value]),
    ],
  })
