<script lang="ts">
  import {onMount} from "svelte"
  import {page} from "$app/stores"
  import {goToHome} from "@app/routes"
  import {shareFromNative} from "@app/share"

  const params = Object.fromEntries($page.url.searchParams)

  onMount(async () => {
    await goToHome()

    shareFromNative(params)
  })
</script>
