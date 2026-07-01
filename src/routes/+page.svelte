<script lang="ts">
  import {goto} from "$app/navigation"
  import {page} from "$app/stores"
  import {goToSpace} from "@app/routes"
  import {PLATFORM_RELAYS} from "@app/env"

  $effect(() => {
    if (PLATFORM_RELAYS.length > 0) {
      goToSpace(PLATFORM_RELAYS[0], $page.url.hash)
    } else {
      goto("/home" + $page.url.hash)
    }
  })
</script>
