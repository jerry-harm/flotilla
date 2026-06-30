<script lang="ts">
  import {deriveRelay} from "@welshman/app"
  import Content from "@app/components/Content.svelte"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const relay = deriveRelay(url)
</script>

{#if $relay?.description}
  <Content event={{content: $relay.description, tags: []}} />
{/if}
