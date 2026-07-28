<script lang="ts">
  import {onMount} from "svelte"
  import {uniq} from "@welshman/lib"
  import {isShareableRelayUrl} from "@welshman/util"
  import {publish} from "@welshman/app"
  import Plane from "@assets/icons/plane.svg?dataurl"
  import Inbox from "@assets/icons/inbox.svg?dataurl"
  import Server from "@assets/icons/server.svg?dataurl"
  import Mailbox from "@assets/icons/mailbox.svg?dataurl"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import ForbiddenCircle from "@assets/icons/forbidden-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import RelaySettingsItem from "@app/components/RelaySettingsItem.svelte"
  import RelaySettingsHealthChecks from "@app/components/RelaySettingsHealthChecks.svelte"
  import {
    blockedRelayLists,
    messagingRelayLists,
    relayLists,
    relays,
    searchRelayLists,
    user,
  } from "@app/core"

  const readRelayUrls = $relayLists.readUrls($user.pubkey).$
  const writeRelayUrls = $relayLists.writeUrls($user.pubkey).$
  const searchRelayUrls = $searchRelayLists.urls($user.pubkey).$
  const blockedRelayUrls = $blockedRelayLists.urls($user.pubkey).$
  const messagingRelayUrls = $messagingRelayLists.urls($user.pubkey).$

  const addReadRelay = (url: string) => $relayLists.addReadUrl(url).then(publish)
  const removeReadRelay = (url: string) => $relayLists.removeReadUrl(url).then(publish)
  const addWriteRelay = (url: string) => $relayLists.addWriteUrl(url).then(publish)
  const removeWriteRelay = (url: string) => $relayLists.removeWriteUrl(url).then(publish)

  const addMessagingRelay = (url: string) => $messagingRelayLists.addUrl(url).then(publish)

  const removeMessagingRelay = (url: string) => $messagingRelayLists.removeUrl(url).then(publish)

  const addSearchRelay = (url: string) => $searchRelayLists.addUrl(url).then(publish)
  const removeSearchRelay = (url: string) => $searchRelayLists.removeUrl(url).then(publish)
  const addBlockedRelay = (url: string) => $blockedRelayLists.addUrl(url).then(publish)

  const removeBlockedRelay = (url: string) => $blockedRelayLists.removeUrl(url).then(publish)

  const relaySupportsSearch = (url: string) => Boolean($relays.get(url)?.hasNip(50))

  // Suggestions come from relay search, which only knows about relays whose NIP-11
  // document has been fetched — so seed it from everyone's relay lists.
  onMount(() => {
    const urls = uniq($relayLists.all.get().flatMap(list => list.urls()))

    for (const url of urls.filter(isShareableRelayUrl)) {
      $relays.load(url)
    }
  })
</script>

<PageContent>
  <RelaySettingsHealthChecks />
  <div class="card flex flex-col gap-4 shadow-md">
    <strong class="flex items-center gap-3 text-lg">
      <Icon icon={Server} />
      Your Relays
    </strong>
    <p class="mb-2">
      Relays are servers which store your data, or allow you to find data from across the Nostr
      network. We've set you up with some reasonable defaults, but if you're a power user, you can
      customize your relay selections below.
    </p>
    <RelaySettingsItem
      icon={Inbox}
      title="Inbox Relays"
      subtitle="Where other people should send notes intended for you. Be sure to select relays that will accept notes that tag you."
      relays={readRelayUrls}
      addRelay={addReadRelay}
      removeRelay={removeReadRelay} />
    <RelaySettingsItem
      icon={Plane}
      title="Outbox Relays"
      subtitle="Where you send your public notes. Be sure to select relays that will accept your notes, and which will let people who follow you read them."
      relays={writeRelayUrls}
      addRelay={addWriteRelay}
      removeRelay={removeWriteRelay} />
    <RelaySettingsItem
      icon={Mailbox}
      title="DM Relays"
      subtitle="Where you send and receive direct messages. Be sure to select relays that will accept your messages and messages from people you'd like to be in contact with."
      relays={messagingRelayUrls}
      addRelay={addMessagingRelay}
      removeRelay={removeMessagingRelay} />
    <RelaySettingsItem
      icon={Magnifier}
      title="Search Relays"
      subtitle="Relays that support searching for profiles and public notes."
      relays={searchRelayUrls}
      addRelay={addSearchRelay}
      removeRelay={removeSearchRelay}
      matchRelay={relaySupportsSearch} />
    <RelaySettingsItem
      icon={ForbiddenCircle}
      title="Blocked Relays"
      subtitle="These relays won't be used unless explicitly requested."
      relays={blockedRelayUrls}
      addRelay={addBlockedRelay}
      removeRelay={removeBlockedRelay} />
  </div>
</PageContent>
