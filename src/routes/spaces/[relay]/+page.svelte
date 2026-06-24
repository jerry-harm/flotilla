<script lang="ts">
  import {page} from "$app/stores"
  import theme from "tailwindcss/defaultTheme"
  import SecondaryNav from "@lib/components/SecondaryNav.svelte"
  import {decodeRelay} from "@app/relays"
  import {goToSpace} from "@app/routes"
  import PrimaryNavSpaces from "@app/components/PrimaryNavSpaces.svelte"
  import SpaceMenu from "@app/components/SpaceMenu.svelte"

  const url = decodeRelay($page.params.relay!)
  const md = parseFloat(theme.screens.md) * 16

  let width = $state(window.innerWidth)

  $effect(() => {
    if (width > md) {
      goToSpace(url)
    }
  })
</script>

<svelte:window bind:innerWidth={width} />

{#if width <= md}
  <div class="primary-nav flex mb-14">
    <PrimaryNavSpaces />
  </div>
  <SecondaryNav visible class="w-auto grow pb-16">
    <SpaceMenu {url} />
  </SecondaryNav>
{/if}
