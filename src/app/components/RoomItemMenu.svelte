<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {ManagementMethod, getAddress, getTagValue} from "@welshman/util"
  import {pubkey, manageRelay, repository} from "@welshman/app"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import GalleryWide from "@assets/icons/gallery-wide.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Danger from "@assets/icons/danger.svg?dataurl"
  import Pin from "@assets/icons/pin.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import Report from "@app/components/Report.svelte"
  import PinboardSelect from "@app/components/PinboardSelect.svelte"
  import EventDeleteConfirm from "@app/components/EventDeleteConfirm.svelte"
  import {ROOM} from "@app/groups"
  import {deriveUserIsRoomAdmin, deriveUserIsSpaceAdmin} from "@app/members"
  import {deriveRoomPinIds, pinRoomMessage, unpinRoomMessage} from "@app/pins"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    event: TrustedEvent
    onClick: () => void
  }

  const {url, event, onClick}: Props = $props()

  const h = getTagValue(ROOM, event.tags) ?? ""
  const pinIds = deriveRoomPinIds(url, h)
  const userIsAdmin = deriveUserIsSpaceAdmin(url)
  const userIsRoomAdmin = deriveUserIsRoomAdmin(url, h)
  const isPinned = $derived($pinIds.includes(event.id))

  const addToLibrary = () => {
    onClick()
    pushModal(PinboardSelect, {url, address: getAddress(event)})
  }

  const report = () => {
    onClick()
    pushModal(Report, {url, event})
  }

  const showInfo = () => {
    onClick()
    pushModal(EventInfo, {url, event})
  }

  const showDelete = () => {
    onClick()
    pushModal(EventDeleteConfirm, {url, event})
  }

  const showAdminDelete = () =>
    pushModal(Confirm, {
      title: `Delete Message`,
      message: `Are you sure you want to delete this message from the space?`,
      confirm: async () => {
        const {error} = await manageRelay(url, {
          method: ManagementMethod.BanEvent,
          params: [event.id],
        })

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Event has successfully been deleted!"})
          repository.removeEvent(event.id)
          history.back()
        }
      },
    })

  const togglePin = async () => {
    onClick()

    if (!h) return

    const error = isPinned
      ? await unpinRoomMessage(url, h, event.id, $pinIds)
      : await pinRoomMessage(url, h, event.id, $pinIds)

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: isPinned ? "Message unpinned" : "Message pinned"})
    }
  }
</script>

<ul class="menu bg-surface whitespace-nowrap rounded-2xl p-2">
  <li>
    <Button onclick={showInfo}>
      <Icon size={4} icon={Code2} />
      Message Details
    </Button>
  </li>
  <li>
    <Button onclick={addToLibrary}>
      <Icon size={4} icon={GalleryWide} />
      Add to Library
    </Button>
  </li>
  {#if h && $userIsRoomAdmin}
    <li>
      <Button onclick={togglePin}>
        <Icon size={4} icon={Pin} />
        {isPinned ? "Unpin Message" : "Pin Message"}
      </Button>
    </li>
  {/if}
  {#if event.pubkey === $pubkey}
    <li>
      <Button onclick={showDelete} class="text-error">
        <Icon size={4} icon={TrashBin2} />
        Delete Message
      </Button>
    </li>
  {:else}
    <li>
      <Button class="text-error" onclick={report}>
        <Icon size={4} icon={Danger} />
        Report Content
      </Button>
    </li>
    {#if $userIsAdmin}
      <li>
        <Button class="text-error" onclick={showAdminDelete}>
          <Icon size={4} icon={TrashBin2} />
          Delete Message
        </Button>
      </li>
    {/if}
  {/if}
</ul>
