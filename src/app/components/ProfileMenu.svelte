<script lang="ts">
  import type {Snippet} from "svelte"
  import {deriveProfile} from "@welshman/app"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import {fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import ProfileInfo from "@app/components/ProfileInfo.svelte"
  import ProfileQrCode from "@app/components/ProfileQrCode.svelte"
  import {pushModal} from "@app/modal"

  type Props = {
    pubkey: string
    url?: string
    customActions?: Snippet
  }

  const {pubkey, url, customActions}: Props = $props()

  const profile = deriveProfile(pubkey)

  let showMenu = $state(false)

  const toggleMenu = () => {
    showMenu = !showMenu
  }

  const closeMenu = () => {
    showMenu = false
  }

  const showInfo = () => {
    closeMenu()
    pushModal(ProfileInfo, {event: $profile!.event, url})
  }

  const showShare = () => {
    closeMenu()
    pushModal(ProfileQrCode, {pubkey})
  }
</script>

<div class="relative">
  <Button class="button button-circle button-ghost button-sm" onclick={toggleMenu}>
    <Icon icon={MenuDots} />
  </Button>
  {#if showMenu}
    <Popover hideOnClick onClose={closeMenu}>
      <ul
        transition:fly
        class="menu bg-surface absolute right-0 z-popover w-48 gap-1 rounded-2xl p-2">
        <li>
          <Button onclick={showShare}>
            <Icon icon={ShareCircle} />
            Share
          </Button>
        </li>
        {#if $profile}
          <li>
            <Button onclick={showInfo}>
              <Icon icon={Code2} />
              Profile Info
            </Button>
          </li>
        {/if}
        {@render customActions?.()}
      </ul>
    </Popover>
  {/if}
</div>
