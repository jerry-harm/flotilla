<script lang="ts">
  import DangerTriangle from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import StatusIndicator from "@lib/components/StatusIndicator.svelte"
  import SocketStatusIndicator from "@app/components/SocketStatusIndicator.svelte"

  type Props = {
    url: string
    error?: string
  }

  const {url, error}: Props = $props()
</script>

<div class="card card-sm flex flex-col gap-2">
  <div class="flex justify-between">
    <strong>Connection Status</strong>
    {#if error}
      <StatusIndicator class="bg-error text-error-content">Error</StatusIndicator>
    {:else}
      <SocketStatusIndicator {url} />
    {/if}
  </div>
  {#if error}
    <div class="flex items-center gap-2">
      <Icon icon={DangerTriangle} />
      <p class="text-sm opacity-75">{error}</p>
    </div>
  {/if}
</div>
