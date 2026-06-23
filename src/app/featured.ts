import {derived} from "svelte/store"
import {now} from "@welshman/lib"
import {APP_DATA, getTagValues} from "@welshman/util"
import type {ManagementMethod} from "@welshman/util"
import {manageRelay} from "@welshman/app"
import {deriveRelaySignedEvents} from "@app/repository"

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
export const setFeaturedContent = async (
  url: string,
  content: string[],
): Promise<string | undefined> => {
  const template = {
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
  }

  const {error} = await manageRelay(url, {
    method: "signevent" as ManagementMethod,
    params: [template as unknown as string],
  })

  return error
}
