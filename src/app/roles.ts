import {derived} from "svelte/store"
import {matchTags, tagSpec} from "@welshman/util"
import {relayMemberLists} from "@app/core"

// Roles are rendered at a fixed saturation and lightness, chosen to read on both themes.
export const roleColor = (hue: number) => `hsl(${hue}, 70%, 50%)`

// A translucent tint of the role color for use as a background fill.
export const roleColorSoft = (hue: number) => `hsl(${hue}, 70%, 50%, 0.15)`

// Map<pubkey, roleId[]> parsed from EXTRA values on ["member", pubkey, ...roleIds] tags
export const deriveSpaceMemberRoles = (url: string) =>
  derived(relayMemberLists.get().forUrl(url), $members => {
    const rolesByPubkey = new Map<string, string[]>()

    for (const [, member, ...roleIds] of matchTags(tagSpec("member"), $members?.tags() ?? [])) {
      if (member) {
        rolesByPubkey.set(member, roleIds)
      }
    }

    return rolesByPubkey
  })
