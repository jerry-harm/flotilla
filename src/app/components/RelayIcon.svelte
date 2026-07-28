<script lang="ts">
  import RemoteControllerMinimalistic from "@assets/icons/remote-controller-minimalistic.svg?dataurl"
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
  <ImageIcon {size} alt="" src={$relay?.icon} class={props.class} />
{:else}
  <ImageIcon size={size - 2} alt="" src={RemoteControllerMinimalistic} class={props.class} />
{/if}
