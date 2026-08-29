<script lang="ts">
  import type {Snippet} from "svelte"
  import type {Instance} from "tippy.js"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileMenuList from "@app/components/ProfileMenuList.svelte"

  type Props = {
    pubkey: string
    url?: string
    customActions?: Snippet
  }

  const {pubkey, url, customActions}: Props = $props()

  const hidePopover = () => popover?.hide()

  let popover: Instance | undefined = $state()
  let showPopover: () => void = $state(() => {})
</script>

<Button onclick={showPopover} class="button button-circle button-ghost button-sm">
  <Tippy
    bind:popover
    bind:show={showPopover}
    component={ProfileMenuList}
    props={{pubkey, url, customActions, onClick: hidePopover}}
    params={{trigger: "manual", interactive: true, placement: "bottom-end"}}>
    <Icon icon={MenuDots} />
  </Tippy>
</Button>
