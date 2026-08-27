<script lang="ts">
  import {removeUndefined, spec} from "@welshman/lib"
  import cx from "classnames"
  import {Track} from "livekit-client"
  import Pin from "@assets/icons/pin.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import VideoCallTile from "@app/components/VideoCallTile.svelte"
  import CallControlBar from "@app/components/CallControlBar.svelte"
  import VoiceParticipantMediaBadges from "@app/components/VoiceParticipantMediaBadges.svelte"
  import {
    VideoCallLayout,
    toggleVideoPrimaryTile,
    videoPrimaryTileKey,
    currentCallSession,
    callTargetRoom,
    mediaStateByIdentity,
    participantMediaState,
    pubkeyFromLiveKitIdentity,
    videoTrackRevision,
    computeAdaptiveGrid,
    type AdaptiveTileGrid,
  } from "@app/call"
  import {deriveDisplaysByPubkey} from "@app/social"

  type Props = {
    layout: VideoCallLayout
    mobile?: boolean
    url: string
    h: string
    class?: string
  }

  type VideoTileData = {
    liveKitIdentity: string
    isLocal: boolean
    trackSid: string
    track: Track | undefined
    source: Track.Source.Camera | Track.Source.ScreenShare
  }

  type TileLayoutVariant = "spotlight" | "default" | "strip"

  const {layout, mobile = false, url, h, class: className = ""}: Props = $props()

  const isViewingCurrentCallRoom = $derived(
    $callTargetRoom?.url === url && $callTargetRoom?.h === h,
  )

  const showVideoContent = $derived(
    isViewingCurrentCallRoom &&
      (layout === VideoCallLayout.Split || layout === VideoCallLayout.Video),
  )

  const videoTiles = $derived.by(() => {
    const session = $currentCallSession
    // LiveKit mutates remoteParticipants/tracks in place; these stores are what
    // actually change on join/leave and track subscribe/unsubscribe.
    void $participantMediaState
    void $videoTrackRevision
    if (!session || $callTargetRoom?.url !== url || $callTargetRoom?.h !== h) {
      return []
    }

    const livekit = session.livekit
    const videoTiles: VideoTileData[] = []
    const user = livekit.localParticipant

    if (session.cameraOn) {
      const localPub = user.getTrackPublication(Track.Source.Camera)
      videoTiles.push({
        liveKitIdentity: user.identity,
        isLocal: true,
        trackSid: localPub?.trackSid ?? "local-camera",
        track: localPub?.track,
        source: Track.Source.Camera,
      })
    }

    if (session.screenShareOn) {
      const localPub = user.getTrackPublication(Track.Source.ScreenShare)
      videoTiles.push({
        liveKitIdentity: user.identity,
        isLocal: true,
        trackSid: localPub?.trackSid ?? "local-screen",
        track: localPub?.track,
        source: Track.Source.ScreenShare,
      })
    }

    for (const rp of livekit.remoteParticipants.values()) {
      const camPub = rp.getTrackPublication(Track.Source.Camera)
      // Camera off mutes the publication rather than unsubscribing; still render avatar.
      if (camPub?.isSubscribed && camPub.track && !camPub.isMuted) {
        videoTiles.push({
          liveKitIdentity: rp.identity,
          isLocal: false,
          trackSid: camPub.trackSid,
          track: camPub.track,
          source: Track.Source.Camera,
        })
      }
      const screenPub = rp.getTrackPublication(Track.Source.ScreenShare)
      if (screenPub?.isSubscribed && screenPub.track && !screenPub.isMuted) {
        videoTiles.push({
          liveKitIdentity: rp.identity,
          isLocal: false,
          trackSid: screenPub.trackSid,
          track: screenPub.track,
          source: Track.Source.ScreenShare,
        })
      }
      if (!videoTiles.some(spec({liveKitIdentity: rp.identity}))) {
        videoTiles.push({
          liveKitIdentity: rp.identity,
          isLocal: false,
          trackSid: `avatar-${rp.identity}`,
          track: undefined,
          source: Track.Source.Camera,
        })
      }
    }

    if (!videoTiles.some(spec({liveKitIdentity: user.identity}))) {
      videoTiles.push({
        liveKitIdentity: user.identity,
        isLocal: true,
        trackSid: "local-avatar",
        track: undefined,
        source: Track.Source.Camera,
      })
    }

    return videoTiles
  })

  /** LiveKit identity + source only — LiveKit can change trackSid after publish, which broke spotlight + stale-key effect. */
  const tileKey = (t: VideoTileData) => `${t.liveKitIdentity}\x1f${t.source}`

  const primaryTile = $derived.by(() => {
    const k = $videoPrimaryTileKey
    if (k === undefined) return undefined
    return videoTiles.find(t => tileKey(t) === k)
  })

  const secondaryTiles = $derived.by(() => {
    const p = primaryTile
    if (p === undefined) return videoTiles
    const pk = tileKey(p)
    return videoTiles.filter(t => tileKey(t) !== pk)
  })

  let gridWidth = $state(0)
  let gridHeight = $state(0)

  const useSpotlightLayout = $derived(primaryTile !== undefined)
  const useMultiGrid = $derived(!useSpotlightLayout)

  const tileGrid = $derived<AdaptiveTileGrid | undefined>(
    useMultiGrid ? computeAdaptiveGrid(videoTiles.length, gridWidth, gridHeight) : undefined,
  )

  $effect(() => {
    const k = $videoPrimaryTileKey
    if (k === undefined) return
    if (!videoTiles.some(t => tileKey(t) === k)) {
      videoPrimaryTileKey.set(undefined)
    }
  })

  const displays = $derived(
    deriveDisplaysByPubkey(
      removeUndefined(videoTiles.map(t => pubkeyFromLiveKitIdentity(t.liveKitIdentity))),
      url,
    ),
  )

  const labelFor = (liveKitIdentity: string, source: VideoTileData["source"]) => {
    const pk = pubkeyFromLiveKitIdentity(liveKitIdentity)
    const name = (pk && $displays.get(pk)) || "Unknown"

    return source === Track.Source.ScreenShare ? `${name} · screen` : name
  }

  const showTileGrid = $derived(videoTiles.length > 0)

  const spotlightHandlerFor = (key: string) => () => {
    toggleVideoPrimaryTile(key)
  }

  const panelChrome = $derived(
    mobile
      ? cx(
          "flex min-h-0 w-full flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden bg-surface px-2 pt-4 md:hidden pb-[calc(3.5rem+var(--saib))]",
          className,
        )
      : "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2 overflow-hidden bg-surface px-2 pb-2 pt-4",
  )

  // Desktop: `className` (the instance's own visibility/sizing, e.g. "hidden ...
  // md:flex") lives on this wrapper rather than on panelChrome, so the floating
  // control bar below shares its box — a `relative` box that's already sized to
  // the real (chat-sidebar-aware) video pane width, since RoomChat now lays the
  // chat sidebar out as a flex sibling instead of an absolute overlay. Centering
  // the controls against this box (instead of the viewport) is what keeps them
  // centered in the actual remaining space as that width animates open/closed.
  const desktopWrapperClass = $derived(cx("relative flex min-h-0 flex-1 flex-col", className))
</script>

{#snippet videoTile(tile: VideoTileData, layout: TileLayoutVariant)}
  {@const media = $mediaStateByIdentity(tile.liveKitIdentity)}
  {@const label = labelFor(tile.liveKitIdentity, tile.source)}
  <div
    class={cx(
      // bg-surface-more (rather than bg-surface, same as the panel behind it) so a
      // camera-off tile reads as its own card instead of blending into the panel.
      "relative isolate overflow-hidden rounded-2xl border border-line shadow-sm",
      layout === "spotlight" && "min-h-0 flex-1",
      layout === "default" && "min-h-0 h-full w-full",
      layout === "strip" && "aspect-video w-44 shrink-0",
      tile.source === Track.Source.ScreenShare ? "bg-black" : "bg-surface-more",
    )}>
    {#if tile.track}
      <VideoCallTile
        track={tile.track}
        muted={tile.isLocal}
        fit={tile.source === Track.Source.ScreenShare ? "contain" : "cover"}
        class="pointer-events-none absolute inset-0" />
    {:else}
      <div class="absolute inset-0 flex items-center justify-center">
        <ProfileCircle pubkey={pubkeyFromLiveKitIdentity(tile.liveKitIdentity)} {url} size={14} />
      </div>
    {/if}
    {#if tile.track}
      <div class="pointer-events-none absolute left-1 top-1 z-10">
        <VoiceParticipantMediaBadges
          muted={media.muted}
          cameraOn={media.cameraOn}
          showCamera={tile.source === Track.Source.Camera}
          size={3} />
      </div>
    {/if}
    <span
      class="pointer-events-none absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-surface/80 px-1.5 py-0.5 text-xs">
      {label}{tile.isLocal ? " (you)" : ""}
    </span>
    {#if videoTiles.length > 1}
      {@const pinned = $videoPrimaryTileKey === tileKey(tile)}
      <Button
        data-tip={pinned ? "Exit spotlight" : "Spotlight"}
        aria-label={pinned ? `Exit spotlight for ${label}` : `Spotlight ${label}`}
        aria-pressed={pinned}
        class={cx(
          `button button-${pinned ? "primary" : "ghost"} button-xs button-square`,
          "absolute right-1 top-1 z-20",
          !pinned && "bg-surface",
        )}
        onclick={spotlightHandlerFor(tileKey(tile))}>
        <Icon icon={Pin} size={3} />
      </Button>
    {/if}
  </div>
{/snippet}

{#snippet videoPanelBody()}
  {#if showTileGrid}
    {#if useSpotlightLayout && primaryTile}
      <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        {@render videoTile(primaryTile, "spotlight")}
        {#if secondaryTiles.length > 0}
          <div
            class="flex max-h-40 shrink-0 flex-row gap-2 overflow-x-auto overflow-y-hidden py-0.5">
            {#each secondaryTiles as tile (tileKey(tile))}
              {@render videoTile(tile, "strip")}
            {/each}
          </div>
        {/if}
      </div>
    {:else if useMultiGrid}
      <div
        bind:clientWidth={gridWidth}
        bind:clientHeight={gridHeight}
        class="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {#if tileGrid}
          <div class="flex flex-col items-center gap-2">
            {#each tileGrid.rows as row, rowIndex (rowIndex)}
              {@const offset = tileGrid.rows
                .slice(0, rowIndex)
                .reduce((sum, r) => sum + r.columnCount, 0)}
              <div
                class="flex flex-nowrap justify-center gap-2"
                style={`max-width: ${row.rowWidth}px`}>
                {#each videoTiles.slice(offset, offset + row.columnCount) as tile (tileKey(tile))}
                  <div
                    class="overflow-hidden rounded-2xl shrink-0"
                    style={`width: ${row.tileWidth}px; height: ${row.tileHeight}px`}>
                    {@render videoTile(tile, "default")}
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <div
      class="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface-more p-4 text-center text-sm opacity-80">
      <p>Waiting for participants…</p>
    </div>
  {/if}
{/snippet}

{#if showVideoContent}
  {#if mobile}
    <div class={panelChrome}>
      {@render videoPanelBody()}
    </div>
    <!-- fixed (viewport-relative), not absolute within panelChrome — panelChrome's
         flex-computed height isn't guaranteed to reach the real viewport bottom, so
         an absolute child positioned against its box can end up overlapping the
         fixed bottom nav bar. Matches the same bottom-nav-clearing offset the old
         chat FAB used.

         RoomChat mounts both a desktop and a mobile VideoCallContent instance at
         once while connected, each gated by its own `class` prop — this instance
         is the mobile one, so it's the only copy visible below md. -->
    <div
      class="left-content pointer-events-none fixed right-sai z-popover flex justify-center bottom-[calc(4.5rem+var(--saib))] md:hidden">
      <CallControlBar {url} {h} />
    </div>
  {:else}
    <!-- desktopWrapperClass carries this instance's own visibility ("hidden ...
         md:flex") and is `relative`, so the control bar below is `absolute` against
         the real (chat-sidebar-aware) video pane box rather than the viewport —
         it re-centers automatically as that box's width animates. -->
    <div class={desktopWrapperClass}>
      <div class={panelChrome}>
        {@render videoPanelBody()}
      </div>
      <div class="pointer-events-none absolute inset-x-0 bottom-4 z-popover flex justify-center">
        <CallControlBar {url} {h} />
      </div>
    </div>
  {/if}
{/if}
