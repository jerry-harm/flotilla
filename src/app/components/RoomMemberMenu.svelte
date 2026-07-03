<script lang="ts">
  import {onMount} from "svelte"
  import {waitForThunkError, removeRoomMember} from "@welshman/app"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import {deriveRoom} from "@app/groups"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    h: string
    pubkey: string
    onClick: () => void
  }

  const {url, h, pubkey, onClick}: Props = $props()

  const room = deriveRoom(url, h)

  const removeMember = () =>
    pushModal(Confirm, {
      title: "Remove Member",
      message: "Are you sure you want to remove this user from the room?",
      confirm: async () => {
        const error = await waitForThunkError(removeRoomMember(url, $room, pubkey))

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Member has successfully been removed!"})
          history.back()
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
    <Button class="text-error" onclick={removeMember}>
      <Icon icon={MinusCircle} />
      Remove Member
    </Button>
  </li>
</ul>
