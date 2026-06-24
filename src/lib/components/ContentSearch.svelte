<script lang="ts">
  interface Props {
    input?: import("svelte").Snippet
    content?: import("svelte").Snippet
    [key: string]: any
  }

  const {...props}: Props = $props()
</script>

<div class="content-search {props.class}">
  <div class="z-feature">
    <div class="content-sizing">
      {@render props.input?.()}
    </div>
  </div>
  <div class="scroll-container content-sizing h-full pt-2">
    {@render props.content?.()}
  </div>
</div>
