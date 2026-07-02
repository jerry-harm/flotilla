<script lang="ts">
  import {deriveRoom} from "@app/groups"

  type Props = {
    url: string
    h: string
    class?: string
  }

  const {url, h, ...props}: Props = $props()

  const room = deriveRoom(url, h)
</script>

<span class="truncate min-w-0 {props.class}">
  {$room?.name || h}
</span>
