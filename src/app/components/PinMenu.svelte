<script lang="ts">
  import {onMount} from "svelte"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import TrashBin from "@assets/icons/trash-bin-2.svg?dataurl"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import PinEdit from "@app/components/PinEdit.svelte"
  import {deriveSupportedMethods} from "@app/relays"
  import {deletePin, type PublishedPin} from "@app/pinboards"
  import {shareEventToChat} from "@app/share"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    pin: PublishedPin
    onClick: () => void
  }

  const {url, pin, onClick}: Props = $props()

  const supportedMethods = deriveSupportedMethods(url)
  const canManage = $derived($supportedMethods.some(m => (m as string) === "signevent"))

  const showInfo = () => pushModal(EventInfo, {url, event: pin.event})

  const share = () => shareEventToChat(url, "Link", pin.event)

  const edit = () => pushModal(PinEdit, {url, pin})

  const confirmDelete = () =>
    pushModal(Confirm, {
      title: "Delete Link",
      message: "Delete this link?",
      confirm: async () => {
        const error = await deletePin(url, pin.id)

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Link deleted!"})
        }
      },
    })

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  <li>
    <Button onclick={showInfo}>
      <Icon icon={Code2} />
      Event details
    </Button>
  </li>
  <li>
    <Button onclick={share}>
      <Icon icon={ShareCircle} />
      Share to chat
    </Button>
  </li>
  {#if canManage}
    <li>
      <Button onclick={edit}>
        <Icon icon={Pen} />
        Edit link
      </Button>
    </li>
    <li>
      <Button class="text-error" onclick={confirmDelete}>
        <Icon icon={TrashBin} />
        Delete link
      </Button>
    </li>
  {/if}
</ul>
