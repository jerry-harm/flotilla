<script lang="ts">
  import {clamp} from "@welshman/lib"
  import {
    pubkey,
    followLists,
    deriveUserWotScore,
    deriveProfileDisplay,
    deriveFollowList,
    followersByPubkey,
    loadFollowList,
    getFollowsWhoFollow,
    getFollowers,
  } from "@welshman/app"
  import Shield from "@assets/icons/shield-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ProfileCircles from "@app/components/ProfileCircles.svelte"

  type Props = {
    pubkey: string
    isSelf?: boolean
  }

  const {pubkey: target, isSelf = false}: Props = $props()

  const score = deriveUserWotScore(target)
  const profileDisplay = deriveProfileDisplay(target)
  const targetFollowList = deriveFollowList(target)

  $effect(() => {
    if (isSelf) return

    loadFollowList(target)

    const viewer = $pubkey

    if (viewer) {
      loadFollowList(viewer)
    }
  })

  const followerCount = $derived.by(() => {
    void $followersByPubkey

    return getFollowers(target).length
  })

  const followsWhoFollow = $derived.by(() => {
    if (isSelf) return []

    const viewer = $pubkey
    void $followLists
    void $targetFollowList

    if (!viewer) return []

    return getFollowsWhoFollow(viewer, target)
  })

  const networkFollowCount = $derived(isSelf ? followerCount : followsWhoFollow.length)

  const displayScore = $derived(isSelf ? followerCount : Math.round(clamp([0, 100], $score)))
  const progress = $derived(isSelf ? undefined : displayScore)

  const trustMessage = $derived.by(() => {
    if (isSelf) {
      if (followerCount === 0) return "No followers in your network yet."

      return `Followed by ${followerCount}+ people in your network.`
    }

    if (!$pubkey) {
      if (displayScore >= 50) return "This user is highly trusted."
      if (displayScore >= 10) return "This user has some trust."

      return "This user is not well known."
    }

    if (networkFollowCount > 0) {
      return `Followed by ${networkFollowCount}+ people in your network.`
    }

    if (displayScore >= 50) return "This user is highly trusted in your network."
    if (displayScore >= 10) return "This user has some trust in your network."

    return "This user is not well known in your network."
  })
</script>

<div class="card card-sm flex flex-col gap-3 sm:gap-4">
  <div class="flex items-center gap-2">
    <Icon icon={Shield} size={5} />
    <strong>Reputation</strong>
  </div>
  <div class="flex flex-col gap-2 border-t border-line pt-4">
    <div class="flex items-end justify-between gap-2">
      <span class="text-sm opacity-75">{isSelf ? "Followers" : "Trust score"}</span>
      <span class="text-lg font-semibold">
        {#if isSelf}
          {displayScore}
        {:else}
          {displayScore} / 100
        {/if}
      </span>
    </div>
    {#if !isSelf}
      <progress class="progress w-full" value={progress} max="100"></progress>
    {/if}
    <p class="text-sm opacity-75">{trustMessage}</p>
  </div>
  {#if followsWhoFollow.length > 0}
    <div class="flex flex-col gap-2 border-t border-line pt-4">
      <p class="text-sm font-medium">People who follow {$profileDisplay}</p>
      <ProfileCircles pubkeys={followsWhoFollow} limit={5} />
      <p class="text-sm opacity-75">
        {followsWhoFollow.length}
        {followsWhoFollow.length === 1 ? "person" : "people"} you follow also follow
        {$profileDisplay}.
      </p>
    </div>
  {/if}
</div>
