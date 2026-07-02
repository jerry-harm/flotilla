<script lang="ts">
  import {type Instance} from "tippy.js"
  import {between} from "@welshman/lib"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import RoomItemMenu from "@app/components/RoomItemMenu.svelte"

  const {url, event} = $props()

  const open = () => popover?.show()

  const onClick = () => popover?.hide()

  const onMouseMove = ({clientX, clientY}: any) => {
    if (popover) {
      const {x, y, width, height} = popover.popper.getBoundingClientRect()

      if (!between([x, x + width], clientX) || !between([y - 50, y + height + 50], clientY)) {
        popover.hide()
      }
    }
  }

  let popover: Instance | undefined = $state()
</script>

<svelte:document onmousemove={onMouseMove} />

<Button onclick={open} class="button button-xs button-neutral join-item">
  <Tippy
    bind:popover
    component={RoomItemMenu}
    props={{url, event, onClick}}
    params={{trigger: "manual", interactive: true}}>
    <Icon icon={MenuDots} size={4} />
  </Tippy>
</Button>
