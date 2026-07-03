<script lang="ts">
  import {onMount} from "svelte"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import TrashBin from "@assets/icons/trash-bin-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import PinEdit from "@app/components/PinEdit.svelte"
  import {deletePin, type Pin} from "@app/pinboards"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    pin: Pin
    onClick: () => void
  }

  const {url, pin, onClick}: Props = $props()

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
</ul>
