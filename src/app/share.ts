import {goto} from "$app/navigation"
import type {TrustedEvent} from "@welshman/util"
import {setKey} from "@lib/implicit"
import {relays} from "@app/core"
import {pushModal} from "@app/modal"
import {makeSpaceChatPath} from "@app/routes"
import EventShare from "@app/components/EventShare.svelte"

// Share an event to chat. On NIP-29 relays we prompt for a room to share into;
// otherwise we stash the event and jump to the space chat composer, which quotes it.
export const shareEventToChat = (url: string, noun: string, event: TrustedEvent) => {
  if (relays.get().get(url)?.hasNip(29)) {
    pushModal(EventShare, {url, noun, event})
  } else {
    setKey("share", event)
    goto(makeSpaceChatPath(url))
  }
}
