<script lang="ts">
  import type {Snippet} from "svelte"
  import Dialog from "@lib/components/Dialog.svelte"
  import Landing from "@app/components/Landing.svelte"
  import Toast from "@app/components/Toast.svelte"
  import PrimaryNav from "@app/components/PrimaryNav.svelte"
  import {app} from "@app/core"
  import {modal} from "@app/modal"

  type Props = {
    children: Snippet
  }

  const {children}: Props = $props()
</script>

<div class="flex h-screen overflow-hidden">
  {#if $app.user?.pubkey}
    <PrimaryNav>
      {@render children?.()}
    </PrimaryNav>
  {:else if !$modal}
    <Dialog noEscape children={{component: Landing, props: {}}} />
  {/if}
</div>
<Toast />
