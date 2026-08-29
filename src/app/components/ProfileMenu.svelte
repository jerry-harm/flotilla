<script lang="ts">
  import type {Snippet} from "svelte"
  import type {Maybe} from "@welshman/lib"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileMenuList from "@app/components/ProfileMenuList.svelte"

  type Props = {
    pubkey: string
    url?: string
    customActions?: Snippet
  }

  const {pubkey, url, customActions}: Props = $props()

  const showPopover = () => tippy?.show()

  const hidePopover = () => tippy?.hide()

  let tippy: Maybe<TippyController> = $state()
</script>

<Button onclick={showPopover} class="button button-circle button-ghost button-sm">
  <Tippy
    bind:controller={tippy}
    component={ProfileMenuList}
    props={{pubkey, url, customActions, onClick: hidePopover}}
    params={{trigger: "manual", interactive: true, placement: "bottom-end"}}>
    <Icon icon={MenuDots} />
  </Tippy>
</Button>
