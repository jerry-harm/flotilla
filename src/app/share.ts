import {get} from "svelte/store"
import {goto} from "$app/navigation"
import type {TrustedEvent} from "@welshman/util"
import {relaysByUrl} from "@welshman/app"
import {setKey} from "@lib/implicit"
import EventShare from "@app/components/EventShare.svelte"
import {hasNip29} from "@app/relays"
import {pushModal} from "@app/modal"
import {makeSpaceChatPath} from "@app/routes"

// Share an event to chat. On NIP-29 relays we prompt for a room to share into;
// otherwise we stash the event and jump to the space chat composer, which quotes it.
export const shareEventToChat = (url: string, noun: string, event: TrustedEvent) => {
  if (hasNip29(get(relaysByUrl).get(url))) {
    pushModal(EventShare, {url, noun, event})
  } else {
    setKey("share", event)
    goto(makeSpaceChatPath(url))
  }
}
