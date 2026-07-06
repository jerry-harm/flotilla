<script module lang="ts">
  const joinPrompted = new Set<string>()
</script>

<script lang="ts">
  import type {Snippet} from "svelte"
  import {page} from "$app/stores"
  import {once} from "@welshman/lib"
  import Page from "@lib/components/Page.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import SpaceMenu from "@app/components/SpaceMenu.svelte"
  import SpaceAuthError from "@app/components/SpaceAuthError.svelte"
  import SpaceTrustRelay from "@app/components/SpaceTrustRelay.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import {modal, pushModal} from "@app/modal"
  import {makeSpacePath} from "@app/routes"
  import {decodeRelay, deriveRelayAuthError} from "@app/relays"
  import {loadUserGroupList, userSpaceUrls} from "@app/groups"
  import {relaysPendingTrust} from "@app/policies"

  type Props = {
    children?: Snippet
  }

  const {children}: Props = $props()

  const url = decodeRelay($page.params.relay!)

  const authError = deriveRelayAuthError(url)

  const showAuthError = once(() =>
    pushModal(SpaceAuthError, {url, error: $authError}, {noEscape: true}),
  )

  const showPendingTrust = once(() => pushModal(SpaceTrustRelay, {url}, {noEscape: true}))

  // Track this manually since we want to avoid race conditions in which we show this prompt before we load
  let spacesLoaded = $state(false)

  // Watch for relay errors and notify the user
  // Direct links skip Discover — prompt to join when relay is not in the user's space list.
  $effect(() => {
    if ($modal) return

    if (!$userSpaceUrls.includes(url) && !joinPrompted.has(url)) {
      if (spacesLoaded) {
        joinPrompted.add(url)
        pushModal(SpaceJoin, {url})
      } else {
        loadUserGroupList([url]).then(() => {
          spacesLoaded = true
        })
      }
    } else if ($authError) {
      showAuthError()
    } else if ($relaysPendingTrust.includes(url)) {
      showPendingTrust()
    }
  })
</script>

{#if $page.url.pathname === makeSpacePath(url)}
  {@render children?.()}
{:else}
  <SecondaryNav>
    <SpaceMenu {url} />
  </SecondaryNav>
  <Page>
    {#key $page.url.pathname}
      {@render children?.()}
    {/key}
  </Page>
{/if}
