<script lang="ts">
  import {displayRelayUrl, ManagementMethod} from "@welshman/util"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import SpaceMemberBannedMenu from "@app/components/SpaceMemberBannedMenu.svelte"
  import {deriveSpaceBannedPubkeyItems} from "@app/members"
  import {deriveSupportedMethods} from "@app/relays"

  interface Props {
    url: string
  }

  const {url}: Props = $props()

  const bans = deriveSpaceBannedPubkeyItems(url)
  const supportedMethods = deriveSupportedMethods(url)
  const canUnban = $derived($supportedMethods.includes(ManagementMethod.UnbanPubkey))
  const canRestore = $derived($supportedMethods.includes(ManagementMethod.AllowPubkey))

  const back = () => history.back()
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Banned users</ModalTitle>
      <ModalSubtitle>on {displayRelayUrl(url)}</ModalSubtitle>
    </ModalHeader>
    <div class="flex flex-col gap-2">
      {#if $bans.length === 0}
        <div class="card bg-surface p-4 text-sm opacity-70">No banned users.</div>
      {/if}
      {#each $bans as { pubkey, reason } (pubkey)}
        <div class="card relative">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex-1">
              <Profile {pubkey} {url} />
            </div>
            {#if canUnban || canRestore}
              <MenuButton component={SpaceMemberBannedMenu} componentProps={{url, pubkey}} />
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Got it
    </Button>
  </ModalFooter>
</Modal>
