<script lang="ts">
  import {page} from "$app/stores"
  import Dialog from "@lib/components/Dialog.svelte"
  import SpaceInviteAccept from "@app/components/SpaceInviteAccept.svelte"
  import {goToHome} from "@app/routes"
  import {modal} from "@app/modal"

  const children = {
    component: SpaceInviteAccept,
    props: {
      hideHeader: true,
      invite: $page.url.href,
      back: goToHome,
    },
  }
</script>

{#if !$modal}
  <Dialog {children} onClose={goToHome} />
{/if}
