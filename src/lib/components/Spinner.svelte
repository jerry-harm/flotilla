<script lang="ts">
  import {slide, fade} from "svelte/transition"

  interface Props {
    loading?: boolean
    children?: import("svelte").Snippet
    class?: string
  }

  const {loading = false, children, ...props}: Props = $props()
</script>

<span class="flex min-h-10 items-center justify-center {props.class}">
  {#if loading}
    <span class="pr-3" transition:slide|local={{axis: "x"}}>
      <span class="loading loading-spinner" transition:fade|local={{duration: 100}}></span>
    </span>
  {/if}
  {@render children?.()}
</span>
