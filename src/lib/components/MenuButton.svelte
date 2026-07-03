<script lang="ts">
  import type {Component} from "svelte"
  import type {Instance} from "tippy.js"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    component: Component<any>
    componentProps?: Record<string, any>
    class?: string
    iconSize?: number
    "aria-label"?: string
  }

  const {
    component,
    componentProps = {},
    class: className = "button button-ghost button-sm button-circle",
    iconSize,
    "aria-label": ariaLabel,
  }: Props = $props()

  const showPopover = () => popover?.show()

  const hidePopover = () => popover?.hide()

  let popover: Instance | undefined = $state()
</script>

<Button class={className} aria-label={ariaLabel} onclick={showPopover}>
  <Tippy
    bind:popover
    {component}
    props={{...componentProps, onClick: hidePopover}}
    params={{trigger: "manual", interactive: true, placement: "bottom-end"}}>
    <Icon icon={MenuDots} size={iconSize} />
  </Tippy>
</Button>
