<script lang="ts">
  import PrimaryNavItemSpace from "@app/components/PrimaryNavItemSpace.svelte"

  type Props = {
    urls: string[]
  }

  const {urls}: Props = $props()
</script>

<div
  class="flex max-h-[80vh] flex-col overflow-y-auto rounded-box border border-solid border-base-content/15 bg-base-200 p-1 shadow-xl">
  {#each urls as url (url)}
    <PrimaryNavItemSpace {url} showTooltip={false} />
  {/each}
</div>
