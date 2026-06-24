<script lang="ts">
  import type {Snippet} from "svelte"

  interface Props {
    children: Snippet
  }

  const {children}: Props = $props()
</script>

<p class="text-muted text-center text-sm">{@render children()}</p>
