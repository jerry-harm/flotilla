<script lang="ts">
  import Server from "@assets/icons/server.svg?dataurl"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import {relays} from "@app/core"

  type Props = {
    url: string
    size?: number
    class?: string
  }

  const {url, size = 7, ...props}: Props = $props()

  const relay = $relays.one(url)
</script>

{#if $relay?.icon}
  <ImageIcon {size} alt="" src={$relay?.icon} class="rounded-full {props.class}" />
{:else}
  <ImageIcon size={size - 2} alt="" src={Server} class={props.class} />
{/if}
