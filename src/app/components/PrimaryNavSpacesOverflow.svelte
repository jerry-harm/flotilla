<script lang="ts">
  import PrimaryNavItemSpace from "@app/components/PrimaryNavItemSpace.svelte"

  type Props = {
    urls: string[]
  }

  const {urls}: Props = $props()
</script>

<div class="flex max-h-[80vh] flex-col overflow-y-auto rounded-2xl border border-solid bg-surface p-1 shadow-xl border-line">
  {#each urls as url (url)}
    <PrimaryNavItemSpace {url} showTooltip={false} />
  {/each}
</div>
