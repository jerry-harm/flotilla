<script lang="ts">
  import type {Snippet} from "svelte"

  interface Props {
    children?: Snippet
  }

  const {children, ...props}: Props = $props()
</script>

<div class="flex items-center gap-2 p-2 text-xs uppercase text-content-subtle">
  <div class="h-px grow" style="background-color: var(--line)"></div>
  {#if children}
    <p>{@render children?.()}</p>
    <div class="h-px grow" style="background-color: var(--line)"></div>
  {/if}
</div>
