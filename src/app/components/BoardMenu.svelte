<script lang="ts">
  import {onMount} from "svelte"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import {type PublishedBoard} from "@app/pinboards"
  import {shareEventToChat} from "@app/share"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    board: PublishedBoard
    onClick: () => void
  }

  const {url, board, onClick}: Props = $props()

  const showInfo = () => pushModal(EventInfo, {url, event: board.event})

  const share = () => shareEventToChat(url, "Shelf", board.event)

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  <li>
    <Button onclick={showInfo}>
      <Icon icon={Code2} />
      Shelf details
    </Button>
  </li>
  <li>
    <Button onclick={share}>
      <Icon icon={ShareCircle} />
      Share to chat
    </Button>
  </li>
</ul>
