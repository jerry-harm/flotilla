<script lang="ts">
  import Tooltip from "@lib/components/Tooltip.svelte"

  type Props = {
    checked?: boolean
    tooltip?: string
    onchange?: (checked: boolean) => void
    [key: string]: any
  }

  let {checked = $bindable(), tooltip, onchange, ...restProps}: Props = $props()

  const onInput = (event: Event & {currentTarget: HTMLInputElement}) =>
    onchange?.(event.currentTarget.checked)
</script>

{#snippet toggle()}
  <input {...restProps} type="checkbox" class="toggle" bind:checked onchange={onInput} />
{/snippet}

<!-- The tooltip hangs off a wrapper rather than the input, so it still shows
     while the toggle is disabled. -->
{#if tooltip}
  <Tooltip content={tooltip}>
    {@render toggle()}
  </Tooltip>
{:else}
  {@render toggle()}
{/if}
