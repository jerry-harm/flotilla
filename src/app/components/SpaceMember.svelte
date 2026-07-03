<script lang="ts">
  import {ManagementMethod} from "@welshman/util"
  import {displayProfileByPubkey} from "@welshman/app"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileAbout from "@app/components/ProfileAbout.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import SpaceMemberMenu from "@app/components/SpaceMemberMenu.svelte"
  import RoleBadge from "@app/components/RoleBadge.svelte"
  import {type SpaceRole} from "@app/members"
  import {deriveSupportedMethods} from "@app/relays"
  import {pushModal} from "@app/modal"

  interface Props {
    url: string
    pubkey: string
    roles?: SpaceRole[]
  }

  const {url, pubkey, roles = []}: Props = $props()

  const supportedMethods = deriveSupportedMethods(url)
  const canUnallow = $derived($supportedMethods.includes(ManagementMethod.UnallowPubkey))
  const canBan = $derived($supportedMethods.includes(ManagementMethod.BanPubkey))
  const canAssign = $derived($supportedMethods.some(m => (m as string) === "assignrole"))
  const canUnassign = $derived($supportedMethods.some(m => (m as string) === "unassignrole"))

  const openProfile = () => pushModal(ProfileDetail, {pubkey, url})
</script>

<div class="card card-interactive card-sm relative">
  <button
    type="button"
    class="absolute inset-0 cursor-pointer rounded-2xl"
    aria-label="View {displayProfileByPubkey(pubkey)}'s profile"
    onclick={openProfile}>
  </button>
  <div class="pointer-events-none relative flex items-start justify-between gap-2">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <Profile {pubkey} {url} inert />
      {#if roles.length > 0}
        <div class="flex flex-wrap gap-1">
          {#each roles as role (role.id)}
            <RoleBadge {role} />
          {/each}
        </div>
      {/if}
      <div class="line-clamp-1 text-sm opacity-70">
        <ProfileAbout {pubkey} {url} singleLine />
      </div>
    </div>
    {#if canAssign || canUnassign || canUnallow || canBan}
      <div class="pointer-events-auto shrink-0">
        <MenuButton
          class="button button-ghost button-sm button-square"
          component={SpaceMemberMenu}
          componentProps={{url, pubkey}} />
      </div>
    {/if}
  </div>
</div>
