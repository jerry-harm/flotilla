<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Classified} from "@welshman/domain"
  import CurrencySymbol from "@lib/components/CurrencySymbol.svelte"
  import {reader} from "@app/core"
  import Content from "@app/components/Content.svelte"
  import ContentLinkBlock from "@app/components/ContentLinkBlock.svelte"

  const props: ComponentProps<typeof Content> = $props()

  const classified = reader(Classified)(props.event)

  const title = classified.title()
  const images = classified.images() ?? []
  const price = classified.price()
</script>

<div class="flex flex-col gap-2">
  {#if title}
    <p class="text-xl">
      {title} —
      <CurrencySymbol code={price?.currency ?? "SAT"} />{price?.amount ?? 0}
    </p>
  {/if}
  {#if props.event.content}
    <Content {...props} />
  {/if}
  <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
    {#each images as image, i (i + image)}
      <ContentLinkBlock event={props.event} value={{url: image}} />
    {/each}
  </div>
</div>
