<script lang="ts">
  import {removeUndefined} from "@welshman/lib"
  import {profiles} from "@app/core"

  type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()

  const profileDisplay = $profiles.display(pubkey, removeUndefined([url])).$
</script>

{$profileDisplay}
