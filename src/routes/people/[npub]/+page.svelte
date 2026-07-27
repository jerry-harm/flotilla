<script lang="ts">
  import {onMount} from "svelte"
  import {get} from "svelte/store"
  import {page} from "$app/stores"
  import {goto} from "$app/navigation"
  import type {MakeNonOptional} from "@welshman/lib"
  import type {Filter} from "@welshman/util"
  import {ROOMS, NOTE, FOLLOWS} from "@welshman/util"
  import {
    loadProfile,
    loadRelayList,
    loadFollowList,
    loadMessagingRelayList,
    loadPinList,
    pubkey as sessionPubkey,
  } from "@welshman/app"
  import {load} from "@welshman/net"
  import {Router} from "@welshman/router"
  import {decodePubkey} from "@lib/util"
  import Page from "@lib/components/Page.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import ProfilePage from "@app/components/ProfilePage.svelte"
  import {loadGroupList} from "@app/groups"
  import {pushToast} from "@app/toast"

  const {npub} = $page.params as MakeNonOptional<typeof $page.params>

  const pubkey = decodePubkey(npub)

  onMount(async () => {
    if (!pubkey) {
      return goto("/people", {replaceState: true})
    }

    try {
      await loadProfile(pubkey)
      await loadRelayList(pubkey)

      const viewer = get(sessionPubkey)

      await Promise.all([
        loadFollowList(pubkey),
        loadPinList(pubkey),
        loadGroupList(pubkey),
        loadMessagingRelayList(pubkey),
        viewer && viewer !== pubkey ? loadFollowList(viewer) : undefined,
      ])

      const filters: Filter[] = [
        {authors: [pubkey], kinds: [ROOMS]},
        {authors: [pubkey], kinds: [NOTE], limit: 1},
      ]

      if (get(sessionPubkey) === pubkey) {
        filters.push({kinds: [FOLLOWS], "#p": [pubkey], limit: 500})
      }

      load({
        relays: Router.get().FromPubkeys([pubkey]).getUrls(),
        filters,
      })
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Some of this profile could not be loaded."})
    }
  })
</script>

<Page>
  <PageContent class="p-0 md:p-4">
    {#if pubkey}
      <ProfilePage {pubkey} />
    {/if}
  </PageContent>
</Page>
