<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import ReportMenuList from "@app/components/ReportMenuList.svelte"

  type Props = {
    url: string
    event: TrustedEvent
    onResolved?: () => void
  }

  const {url, event, onResolved}: Props = $props()
</script>

<MenuButton component={ReportMenuList} componentProps={{url, event, onResolved}} />
