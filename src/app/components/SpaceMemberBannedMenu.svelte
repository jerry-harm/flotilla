<script lang="ts">
  import {onMount} from "svelte"
  import Restart from "@assets/icons/restart.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import {deriveSpaceSupportedMethods} from "@app/management"
  import {pushToast} from "@app/toast"
  import {relayManagement} from "@app/core"

  type Props = {
    url: string
    pubkey: string
    onClick: () => void
  }

  const {url, pubkey, onClick}: Props = $props()

  const supportedMethods = deriveSpaceSupportedMethods(url)
  const canUnban = $derived($supportedMethods.includes("unbanpubkey"))
  const canRestore = $derived($supportedMethods.includes("allowpubkey"))

  const back = () => history.back()

  const unbanMember = async () => {
    const {error} = await $relayManagement.forUrl(url).unbanPubkey(pubkey)

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "User has successfully been removed from the ban list!"})
      back()
    }
  }

  const restoreMember = async () => {
    const {error} = await $relayManagement.forUrl(url).allowPubkey(pubkey)

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: "User has successfully been restored to membership!"})
      back()
    }
  }

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  {#if canUnban}
    <li>
      <Button onclick={unbanMember}>
        <Icon icon={CloseCircle} />
        Unban User
      </Button>
    </li>
  {/if}
  {#if canRestore}
    <li>
      <Button onclick={restoreMember}>
        <Icon icon={Restart} />
        Restore User
      </Button>
    </li>
  {/if}
</ul>
