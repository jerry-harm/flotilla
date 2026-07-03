<script lang="ts">
  import {onMount} from "svelte"
  import {goto} from "$app/navigation"
  import {displayProfileByPubkey, loadMessagingRelayList} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import UserMinus from "@assets/icons/user-minus.svg?dataurl"
  import Restart from "@assets/icons/restart.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileAbout from "@app/components/ProfileAbout.svelte"
  import ProfileBadges from "@app/components/ProfileBadges.svelte"
  import ProfileMenu from "@app/components/ProfileMenu.svelte"
  import {
    deriveUserIsSpaceAdmin,
    deriveSpaceBannedPubkeyItems,
    removeSpaceMembers,
    addSpaceMembers,
    banSpaceMembers,
  } from "@app/members"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"
  import {makeProfilePath} from "@app/routes"

  export type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()

  const userIsAdmin = deriveUserIsSpaceAdmin(url)

  const bannedPubkeys = url ? deriveSpaceBannedPubkeyItems(url) : undefined

  const isBanned = $derived($bannedPubkeys?.some(item => item.pubkey === pubkey) ?? false)

  const back = () => history.back()

  const viewProfile = () => goto(makeProfilePath(pubkey), {replaceState: true})

  const banMember = () =>
    pushModal(Confirm, {
      title: "Ban User",
      message: `Are you sure you want to ban @${displayProfileByPubkey(pubkey)} from the space?`,
      confirm: async () => {
        const error = await banSpaceMembers(url!, [pubkey])

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "User has successfully been banned!"})
          back()
        }
      },
    })

  const removeMember = async () => {
    const error = await removeSpaceMembers(url!, [pubkey])

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "User has successfully been removed!"})
      back()
    }
  }

  const restoreMember = async () => {
    const error = await addSpaceMembers(url!, [pubkey])

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "User has successfully been restored!"})
      back()
    }
  }

  onMount(() => {
    loadMessagingRelayList(pubkey)
  })
</script>

<Modal>
  <ModalBody>
    <div class="flex flex-col gap-4">
      <div class="flex justify-between">
        <Profile showPubkey avatarSize={14} {pubkey} {url} />
        <ProfileMenu {pubkey} {url}>
          {#snippet customActions()}
            {#if $userIsAdmin}
              {#if isBanned}
                <li>
                  <Button onclick={restoreMember}>
                    <Icon icon={Restart} />
                    Restore Membership
                  </Button>
                </li>
              {:else}
                <li>
                  <Button onclick={removeMember}>
                    <Icon icon={UserMinus} />
                    Remove Member
                  </Button>
                </li>
                <li>
                  <Button class="text-error" onclick={banMember}>
                    <Icon icon={MinusCircle} />
                    Ban User
                  </Button>
                </li>
              {/if}
            {/if}
          {/snippet}
        </ProfileMenu>
      </div>
      <ProfileAbout {pubkey} {url} />
      <ProfileBadges {pubkey} {url} />
    </div>
  </ModalBody>
  <ModalFooter>
    <Button onclick={back} class="button button-link hidden md:flex">
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <div class="flex gap-2">
      <Button onclick={viewProfile} class="button button-primary">
        <Icon icon={UserCircle} />
        View Full Profile
      </Button>
    </div>
  </ModalFooter>
</Modal>
