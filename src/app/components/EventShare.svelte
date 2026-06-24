<script lang="ts">
  import cx from "classnames"
  import {goto} from "$app/navigation"
  import type {TrustedEvent} from "@welshman/util"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import {setKey} from "@lib/implicit"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {roomsByUrl} from "@app/groups"
  import {makeRoomPath} from "@app/routes"

  const {url, noun, event}: {url: string; noun: string; event: TrustedEvent} = $props()

  const back = () => history.back()

  const onSubmit = () => {
    setKey("share", event)
    goto(makeRoomPath(url, selection), {replaceState: true})
  }

  const toggleRoom = (h: string) => {
    selection = h === selection ? "" : h
  }

  let selection = $state("")
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Share {noun}</ModalTitle>
      <ModalSubtitle>Which room would you like to share this event to?</ModalSubtitle>
    </ModalHeader>
    <div class="grid grid-cols-3 gap-2">
      {#each $roomsByUrl.get(url) || [] as room (room.h)}
        <Button
          type="button"
          class={cx(`button button-${selection === room.h ? "primary" : "neutral"}`)}
          onclick={() => toggleRoom(room.h)}>
          #<RoomName {...room} />
        </Button>
      {/each}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={!selection}>
      Share {noun}
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
