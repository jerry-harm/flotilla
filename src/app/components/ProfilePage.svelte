<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {displayPubkey} from "@welshman/util"
  import {
    pubkey,
    followLists,
    deriveProfile,
    deriveProfileDisplay,
    getFollows,
    follow,
    unfollow,
    tagPubkey,
    loadRelayList,
  } from "@welshman/app"
  import {compressFile} from "@lib/html"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Letter from "@assets/icons/letter-opened.svg?dataurl"
  import UserPlus from "@assets/icons/user-plus.svg?dataurl"
  import PenNewSquare from "@assets/icons/pen-new-square.svg?dataurl"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import ShareCircle from "@assets/icons/share-circle.svg?dataurl"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import {fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileTrust from "@app/components/ProfileTrust.svelte"
  import ProfileSharedSpaces from "@app/components/ProfileSharedSpaces.svelte"
  import ProfilePageNotes from "@app/components/ProfilePageNotes.svelte"
  import ProfileQrCode from "@app/components/ProfileQrCode.svelte"
  import ProfileEdit from "@app/components/ProfileEdit.svelte"
  import WotScore from "@app/components/WotScore.svelte"
  import Content from "@app/components/Content.svelte"
  import {updateProfile} from "@app/profiles"
  import {uploadFile} from "@app/uploads"
  import {pushModal} from "@app/modal"
  import {clip, pushToast} from "@app/toast"
  import {goToChat} from "@app/routes"

  type Props = {
    pubkey: string
  }

  const {pubkey: target}: Props = $props()

  const profile = deriveProfile(target)
  const profileDisplay = deriveProfileDisplay(target)
  const encodedNpub = nip19.npubEncode(target)
  const isSelf = $derived($pubkey === target)
  const isFollowing = $derived.by(() => {
    void $followLists

    return $pubkey ? getFollows($pubkey).includes(target) : false
  })
  const website = $derived($profile?.website?.replace(/^https?:\/\//, ""))
  const websiteHref = $derived(
    $profile?.website?.match(/^https?:\/\//)
      ? $profile.website
      : `https://${$profile?.website || ""}`,
  )

  let showMenu = $state(false)
  let bannerLoading = $state(false)
  let bannerInput: HTMLInputElement | undefined = $state()

  const copyNpub = () => clip(encodedNpub)

  const showShare = () => {
    closeMenu()
    pushModal(ProfileQrCode, {pubkey: target})
  }

  const startEdit = () => pushModal(ProfileEdit)

  const toggleMenu = () => {
    showMenu = !showMenu
  }

  const closeMenu = () => {
    showMenu = false
  }

  const openChat = () => goToChat([target])

  const toggleFollow = async () => {
    if (!$pubkey || isSelf) return

    if (isFollowing) {
      await unfollow(target)
    } else {
      await follow(tagPubkey(target))
    }
  }

  const openBannerPicker = () => bannerInput?.click()

  const onBannerChange = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]

    input.value = ""

    if (!file || !$profile) return

    bannerLoading = true

    try {
      const {result} = await uploadFile(await compressFile(file))

      if (result?.url) {
        await updateProfile({profile: {...$profile, banner: result.url}})
        pushToast({message: "Banner updated."})
      }
    } finally {
      bannerLoading = false
    }
  }
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-col gap-3 xl:flex-row xl:items-start">
    <div class="min-w-0 flex-1 overflow-hidden border-line bg-surface md:rounded-3xl md:border">
      <div class="relative overflow-hidden border-b border-line bg-surface-more">
        {#if $profile?.banner}
          <img src={$profile.banner} alt="" class="h-28 w-full object-cover sm:h-32 md:h-40" />
        {:else}
          <div class="h-28 w-full bg-linear-to-br from-surface-more to-surface sm:h-32 md:h-40">
          </div>
        {/if}
        {#if isSelf}
          <Button
            class="button button-neutral button-sm absolute top-2 right-2 sm:top-3 sm:right-3"
            disabled={bannerLoading}
            onclick={openBannerPicker}>
            <Icon icon={GallerySend} size={4} />
            <span class="hidden sm:inline">Change banner</span>
          </Button>
          <input
            bind:this={bannerInput}
            type="file"
            accept="image/*"
            class="hidden"
            onchange={onBannerChange} />
        {/if}
      </div>

      <div class="relative border-b border-line px-4 pb-4 sm:px-3 sm:pb-5">
        <div class="-mt-8 sm:-mt-10">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div class="w-fit shrink-0">
              <div
                class="w-fit rounded-full border-4 border-surface bg-surface sm:border-surface-more sm:bg-surface-more">
                <ProfileCircle pubkey={target} size={16} class="sm:hidden" />
                <ProfileCircle pubkey={target} size={20} class="hidden! sm:block" />
              </div>
            </div>

            <div class="flex min-w-0 flex-1 flex-col gap-3 sm:gap-2 sm:pt-14">
              <div
                class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-x-4">
                <h1
                  class="flex min-w-0 items-center gap-2 text-xl leading-tight font-bold sm:text-2xl">
                  <span class="truncate">{$profileDisplay}</span>
                  {#if !isSelf}
                    <WotScore pubkey={target} />
                  {/if}
                </h1>

                {#if $profile}
                  <div class="flex items-center gap-2">
                    {#if isSelf}
                      <Button
                        class="button button-primary flex-1 sm:button-sm sm:flex-none"
                        onclick={startEdit}>
                        <Icon icon={PenNewSquare} size={4} />
                        Edit profile
                      </Button>
                    {:else if $pubkey}
                      <Button
                        class="button button-neutral flex-1 sm:button-sm sm:flex-none"
                        onclick={toggleFollow}>
                        <Icon icon={UserPlus} size={4} />
                        {isFollowing ? "Unfollow" : "Follow"}
                      </Button>
                      <Button
                        class="button button-primary flex-1 sm:button-sm sm:flex-none"
                        onclick={openChat}>
                        <Icon icon={Letter} size={4} />
                        Message
                      </Button>
                    {/if}

                    <div class="relative shrink-0">
                      <Button
                        class="button button-circle button-ghost button-sm"
                        onclick={toggleMenu}>
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
                          </ul>
                        </Popover>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>

              <div class="flex items-center gap-1 text-sm leading-none opacity-75">
                <span>{displayPubkey(target)}</span>
                <Button
                  onclick={copyNpub}
                  class="button button-ghost button-xs h-5 min-h-5 w-5 p-0">
                  <Icon size={3} icon={Copy} />
                </Button>
              </div>

              {#if website}
                <Link
                  external
                  href={websiteHref}
                  class="link flex w-fit items-center gap-2 text-sm font-medium">
                  <Icon icon={LinkRound} size={4} />
                  {website}
                </Link>
              {/if}

              {#if $profile?.about}
                <Content
                  event={{content: $profile.about, tags: []}}
                  expandMode="block"
                  minLength={150}
                  maxLength={250} />
              {/if}
            </div>
          </div>
        </div>
      </div>

      <div class="bg-surface-less px-4 py-3 sm:px-3 sm:py-4">
        <div class="flex flex-col gap-4 sm:pl-3">
          <div class="flex flex-col gap-3 xl:hidden">
            <ProfileTrust pubkey={target} {isSelf} />
            <ProfileSharedSpaces pubkey={target} {isSelf} />
          </div>
          {#await loadRelayList(target)}
            <p class="my-12 flex items-center justify-center gap-2">
              <Spinner loading />
              Loading notes...
            </p>
          {:then}
            <ProfilePageNotes pubkey={target} />
          {/await}
        </div>
      </div>
    </div>

    <aside class="hidden w-80 shrink-0 xl:block xl:pl-4">
      <div class="flex flex-col gap-3">
        <ProfileTrust pubkey={target} {isSelf} />
        <ProfileSharedSpaces pubkey={target} {isSelf} />
      </div>
    </aside>
  </div>
</div>
