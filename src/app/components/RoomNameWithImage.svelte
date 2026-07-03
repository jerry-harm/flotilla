<script lang="ts">
  import RoomName from "@app/components/RoomName.svelte"
  import RoomImage from "@app/components/RoomImage.svelte"

  interface Props {
    h: string
    url: string
    class?: string
  }

  const {url, h, ...props}: Props = $props()
</script>

<div class="inline-flex min-w-0 items-center gap-2 {props.class}">
  <RoomImage {url} {h} />
  <div class="min-w-0 overflow-hidden text-ellipsis">
    <RoomName {url} {h} />
  </div>
</div>
