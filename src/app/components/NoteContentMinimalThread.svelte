<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {tagSpec, tagValue} from "@welshman/util"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const title = tagValue(tagSpec("title"), props.event.tags)
</script>

{#if title}
  <span class="text-sm">{title}</span>
{/if}
{#if props.event.content}
  <ContentMinimal {...props} />
{/if}
