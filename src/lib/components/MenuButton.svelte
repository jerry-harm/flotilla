<script lang="ts">
  import type {Component} from "svelte"
  import type {Maybe} from "@welshman/lib"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
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

  const showPopover = () => tippy?.show()

  const hidePopover = () => tippy?.hide()

  let tippy: Maybe<TippyController> = $state()
</script>

<Button class={className} aria-label={ariaLabel} onclick={showPopover}>
  <Tippy
    bind:controller={tippy}
    {component}
    props={{...componentProps, onClick: hidePopover}}
    params={{trigger: "manual", interactive: true, placement: "bottom-end"}}>
    <Icon icon={MenuDots} size={iconSize} />
  </Tippy>
</Button>
