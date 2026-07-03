<script lang="ts">
  import {onMount} from "svelte"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    onDelete: () => void
    onClick: () => void
  }

  const {onDelete, onClick}: Props = $props()

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  <li>
    <Button onclick={onDelete}>
      <Icon icon={TrashBin2} />
      Delete Session
    </Button>
  </li>
</ul>
