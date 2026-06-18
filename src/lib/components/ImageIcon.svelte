<script lang="ts">
  import Icon from "@lib/components/Icon.svelte"

  type Props = {
    src: string
    alt: string
    size?: number
    class?: string
    style?: string
  }

  const {src, alt, size = 5, style, class: className}: Props = $props()

  const rem = size * 0.25

  const imgStyle = $derived(
    `width: ${rem}rem; height: ${rem}rem; min-width: ${rem}rem; min-height: ${rem}rem${style ? `; ${style}` : ""}`,
  )
</script>

{#if src.includes("image/svg") || src.endsWith(".svg")}
  <Icon icon={src} {size} {style} class={className} />
{:else}
  <img {src} {alt} style={imgStyle} class="aspect-square object-cover {className}" />
{/if}
