import {Capacitor} from "@capacitor/core"
import * as nip19 from "nostr-tools/nip19"
import {identity} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"

const fromCsv = (s: string) => (s || "").split(",").filter(identity)

export const PUSH_SERVER = import.meta.env.VITE_PUSH_SERVER

export const PUSH_BRIDGE = normalizeRelayUrl(import.meta.env.VITE_PUSH_BRIDGE)

export const ENABLE_ZAPS = Capacitor.getPlatform() != "ios"

export const SIGNER_RELAYS = fromCsv(import.meta.env.VITE_SIGNER_RELAYS).map(normalizeRelayUrl)

export const BLOCKED_RELAYS = fromCsv(import.meta.env.VITE_BLOCKED_RELAYS).map(normalizeRelayUrl)

export const INDEXER_RELAYS = fromCsv(import.meta.env.VITE_INDEXER_RELAYS).map(normalizeRelayUrl)

export const DEFAULT_RELAYS = fromCsv(import.meta.env.VITE_DEFAULT_RELAYS).map(normalizeRelayUrl)

export const DEFAULT_SEARCH_RELAYS = fromCsv(import.meta.env.VITE_DEFAULT_SEARCH_RELAYS).map(
  normalizeRelayUrl,
)

export const DEFAULT_MESSAGING_RELAYS = fromCsv(import.meta.env.VITE_DEFAULT_MESSAGING_RELAYS).map(
  normalizeRelayUrl,
)

export const PLATFORM_RELAYS = fromCsv(import.meta.env.VITE_PLATFORM_RELAYS).map(normalizeRelayUrl)

export const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL

export const PLATFORM_TERMS = import.meta.env.VITE_PLATFORM_TERMS

export const PLATFORM_PRIVACY = import.meta.env.VITE_PLATFORM_PRIVACY

export const PLATFORM_LOGO = import.meta.env.PROD
  ? PLATFORM_URL + "/logo.png"
  : import.meta.env.VITE_PLATFORM_LOGO.replace(/^static/, "") || PLATFORM_URL + "/logo.png"

export const PLATFORM_NAME = import.meta.env.VITE_PLATFORM_NAME

export const PLATFORM_ACCENT = import.meta.env.VITE_PLATFORM_ACCENT

// components visual preset (see src/lib/components/theme.css). Selected per
// deployment via VITE_THEME, which is assumed to be set to a known theme
// (e.g. "clay" or "flat") — there is no default.
export const FL_THEME = import.meta.env.VITE_THEME

export const PLATFORM_DESCRIPTION = import.meta.env.VITE_PLATFORM_DESCRIPTION

export const POMADE_SIGNERS = fromCsv(import.meta.env.VITE_POMADE_SIGNERS)

export const DEFAULT_BLOSSOM_SERVERS = fromCsv(import.meta.env.VITE_DEFAULT_BLOSSOM_SERVERS)

export const DEFAULT_SPACES = fromCsv(import.meta.env.VITE_DEFAULT_SPACES).map(normalizeRelayUrl)

export const DEFAULT_PUBKEYS = import.meta.env.VITE_DEFAULT_PUBKEYS

export const HOSTING_BACKEND_URL = import.meta.env.VITE_HOSTING_BACKEND_URL

export const HOSTING_RELAY_DOMAIN = import.meta.env.VITE_HOSTING_RELAY_DOMAIN

export const DUFFLEPUD_URL = "https://dufflepud.coracle.social"

export const THUMBNAIL_URL = import.meta.env.VITE_THUMBNAIL_URL

export const dufflepud = (path: string) => DUFFLEPUD_URL + "/" + path

export const entityLink = (entity: string) => `https://coracle.social/${entity}`

export const pubkeyLink = (pubkey: string, relays: string[] = []) =>
  entityLink(nip19.nprofileEncode({pubkey, relays}))
