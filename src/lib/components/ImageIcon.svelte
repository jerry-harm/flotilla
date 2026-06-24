<script lang="ts">
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    src: string
    alt: string
    size?: number
    class?: string
    style?: string
  }

  const {src, alt, size = 5, style = undefined, ...props}: Props = $props()
</script>

{#if src.includes("image/svg") || src.endsWith(".svg")}
  <Icon icon={src} {size} {style} class={props.class} />
{:else}
  <img
    {src}
    {alt}
    {style}
    class="h-{size} w-{size} min-w-{size} min-h-{size} aspect-square object-cover rounded-full {props.class}" />
{/if}
