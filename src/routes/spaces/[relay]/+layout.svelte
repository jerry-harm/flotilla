<script module lang="ts">
  const joinPrompted = new Set<string>()
  const redirectPrompted = new Set<string>()
</script>

<script lang="ts">
  import type {Snippet} from "svelte"
  import {page} from "$app/stores"
  import type {Maybe} from "@welshman/lib"
  import {once} from "@welshman/lib"
  import Page from "@lib/components/Page.svelte"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import SpaceMenu from "@app/components/SpaceMenu.svelte"
  import SpaceAuthError from "@app/components/SpaceAuthError.svelte"
  import SpaceTrustRelay from "@app/components/SpaceTrustRelay.svelte"
  import SpaceJoin from "@app/components/SpaceJoin.svelte"
  import SpaceRedirect from "@app/components/SpaceRedirect.svelte"
  import {deriveRelayAuthError} from "@app/access"
  import {loadUserGroupList, userSpaceUrls} from "@app/groups"
  import {modal, pushModal} from "@app/modal"
  import {relaysPendingTrust} from "@app/policies"
  import {decodeRelay, fetchRelayRedirect} from "@app/relays"
  import {makeSpacePath} from "@app/routes"

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

  // Detect a moved custom domain (see fetchRelayRedirect)
  const checkRedirect = once(() => {
    fetchRelayRedirect(url).then(next => {
      redirectUrl = next
    })
  })

  // Track this manually since we want to avoid race conditions in which we show this prompt before we load
  let spacesLoaded = $state(false)

  let redirectUrl = $state<Maybe<string>>()

  $effect(checkRedirect)

  // Watch for relay errors and notify the user
  // Direct links skip Discover — prompt to join when relay is not in the user's space list.
  $effect(() => {
    if ($modal) return

    if (redirectUrl && !redirectPrompted.has(url)) {
      redirectPrompted.add(url)
      pushModal(SpaceRedirect, {url, newUrl: redirectUrl})
    } else if (!$userSpaceUrls.includes(url) && !joinPrompted.has(url)) {
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
