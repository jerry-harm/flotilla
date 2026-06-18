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
  import Spinner from "@lib/components/Spinner.svelte"
  import ProfilePage from "@app/components/ProfilePage.svelte"
  import {loadGroupList} from "@app/groups"

  const {npub} = $page.params as MakeNonOptional<typeof $page.params>

  let pubkey = $state<string | undefined>()
  let ready = $state(false)

  onMount(async () => {
    const decoded = decodePubkey(npub)

    if (!decoded) {
      goto("/people", {replaceState: true})

      return
    }

    pubkey = decoded

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

      ready = true
    } catch {
      goto("/people", {replaceState: true})
    }
  })
</script>

<Page>
  <PageContent class="p-0 md:p-4">
    {#if ready && pubkey}
      <ProfilePage {pubkey} />
    {:else}
      <p class="flex items-center justify-center py-20">
        <Spinner loading />
      </p>
    {/if}
  </PageContent>
</Page>
