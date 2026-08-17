<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {Article} from "@welshman/domain"
  import Content from "@app/components/Content.svelte"
  import {reader} from "@app/core"

  const props: ComponentProps<typeof Content> = $props()

  const article = reader(Article)(props.event)

  const title = article.title()
  const image = article.image()
</script>

<div class="flex flex-col gap-2">
  {#if image}
    <img src={image} alt="" class="h-40 w-full rounded-2xl object-cover" />
  {/if}
  {#if title}
    <p class="text-xl">{title}</p>
  {/if}
  {#if props.event.content}
    <Content {...props} />
  {/if}
</div>
