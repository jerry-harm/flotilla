<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import type {RoomMeta} from "@welshman/util"
  import {makeRoomMeta} from "@welshman/util"
  import type {Thunk} from "@welshman/app"
  import {deleteRoom, waitForThunkError, repository, joinRoom, leaveRoom} from "@welshman/app"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Login3 from "@assets/icons/login-3.svg?dataurl"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import RoomEdit from "@app/components/RoomEdit.svelte"
  import {deriveRoom, removeRoom} from "@app/groups"
  import {
    deriveUserIsRoomAdmin,
    deriveUserRoomMembershipStatus,
    MembershipStatus,
  } from "@app/members"
  import {makeSpacePath} from "@app/routes"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    h: string
    onClick: () => void
  }

  const {url, h, onClick}: Props = $props()

  const room = deriveRoom(url, h)
  const userIsAdmin = deriveUserIsRoomAdmin(url, h)
  const membershipStatus = deriveUserRoomMembershipStatus(url, h)

  const startEdit = () => pushModal(RoomEdit, {url, h})

  const handleLoading = async (f: (url: string, room: RoomMeta) => Thunk) => {
    loading = true

    try {
      const message = await waitForThunkError(f(url, makeRoomMeta({h})))

      if (message && !message.startsWith("duplicate:")) {
        pushToast({theme: "error", message})
      }
    } finally {
      loading = false
    }
  }

  const join = () => handleLoading(joinRoom)

  const leave = () => handleLoading(leaveRoom)

  const startDelete = () =>
    pushModal(Confirm, {
      title: "Are you sure you want to delete this room?",
      message:
        "This room will no longer be accessible to space members, and all messages posted to it will be deleted.",
      confirm: async () => {
        const thunk = deleteRoom(url, $room)
        const message = await waitForThunkError(thunk)

        if (message) {
          repository.removeEvent(thunk.event.id)
          pushToast({theme: "error", message})
        } else {
          await removeRoom(url, h)
          goto(makeSpacePath(url))
        }
      },
    })

  let loading = $state(false)
  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  {#if $userIsAdmin}
    <li>
      <Button onclick={startEdit}>
        <Icon icon={Pen} />
        Edit Room
      </Button>
    </li>
    <li>
      <Button class="text-error" onclick={startDelete}>
        <Icon icon={TrashBin2} />
        Delete Room
      </Button>
    </li>
  {:else if $membershipStatus === MembershipStatus.Initial}
    <li>
      <Button disabled={loading} onclick={join}>
        {#if loading}
          <Spinner size="sm" />
        {:else}
          <Icon icon={Login3} />
        {/if}
        Join member list
      </Button>
    </li>
  {:else if $membershipStatus === MembershipStatus.Pending}
    <li>
      <Button>
        <Icon icon={ClockCircle} />
        Membership pending
      </Button>
    </li>
  {:else}
    <li>
      <Button disabled={loading} onclick={leave}>
        {#if loading}
          <Spinner size="sm" />
        {:else}
          <Icon icon={Login3} />
        {/if}
        Leave member list
      </Button>
    </li>
  {/if}
</ul>
