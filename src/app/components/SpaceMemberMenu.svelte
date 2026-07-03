<script lang="ts">
  import {onMount} from "svelte"
  import {ManagementMethod} from "@welshman/util"
  import {displayProfileByPubkey} from "@welshman/app"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import UserMinus from "@assets/icons/user-minus.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import SpaceMemberRoles from "@app/components/SpaceMemberRoles.svelte"
  import {removeSpaceMembers, banSpaceMembers} from "@app/members"
  import {deriveSupportedMethods} from "@app/relays"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    pubkey: string
    onClick: () => void
  }

  const {url, pubkey, onClick}: Props = $props()

  const supportedMethods = deriveSupportedMethods(url)
  const canUnallow = $derived($supportedMethods.includes(ManagementMethod.UnallowPubkey))
  const canBan = $derived($supportedMethods.includes(ManagementMethod.BanPubkey))
  const canAssign = $derived($supportedMethods.some(m => (m as string) === "assignrole"))
  const canUnassign = $derived($supportedMethods.some(m => (m as string) === "unassignrole"))

  const back = () => history.back()

  const editRoles = () => pushModal(SpaceMemberRoles, {url, pubkey})

  const removeMember = () =>
    pushModal(Confirm, {
      title: "Remove Member",
      message: `Remove @${displayProfileByPubkey(pubkey)} from the space?`,
      confirm: async () => {
        const error = await removeSpaceMembers(url, [pubkey])

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Member has successfully been removed!"})
          back()
        }
      },
    })

  const banMember = () =>
    pushModal(Confirm, {
      title: "Ban Member",
      message: `Ban @${displayProfileByPubkey(pubkey)} from the space?`,
      confirm: async () => {
        const error = await banSpaceMembers(url, [pubkey])

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Member has successfully been banned!"})
          back()
        }
      },
    })

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  {#if canAssign || canUnassign}
    <li>
      <Button onclick={editRoles}>
        <Icon icon={Pen} />
        Edit roles
      </Button>
    </li>
  {/if}
  {#if canUnallow}
    <li>
      <Button onclick={removeMember}>
        <Icon icon={UserMinus} />
        Remove member
      </Button>
    </li>
  {/if}
  {#if canBan}
    <li>
      <Button class="text-error" onclick={banMember}>
        <Icon icon={MinusCircle} />
        Ban member
      </Button>
    </li>
  {/if}
</ul>
