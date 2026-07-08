<script lang="ts">
  import type {ComponentProps} from "svelte"
  import Content from "@app/components/Content.svelte"
  import {readBoard} from "@app/pinboards"

  const props: ComponentProps<typeof Content> = $props()

  const board = readBoard(props.event)
</script>

<div class="flex flex-col">
  <strong class="text-lg">{board.title || "Untitled shelf"}</strong>
  {#if board.description}
    <span class="text-sm opacity-70">{board.description}</span>
  {/if}
</div>
