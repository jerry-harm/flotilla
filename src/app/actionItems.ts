import {derived} from "svelte/store"
import {REPORT, sortEventsDesc} from "@welshman/util"
import {rooms} from "@app/core"
import {deriveEventsForUrl} from "@app/repository"

// Action items (admin review queue)

export const deriveSpaceActionItems = (url: string) =>
  derived(
    [deriveEventsForUrl(url, [{kinds: [REPORT]}]), rooms.get().pendingJoins(url).$],
    ([$reports, $pendingJoins]) => sortEventsDesc([...$reports, ...$pendingJoins]),
  )
