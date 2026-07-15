<script lang="ts">
  import cx from "classnames"
  import {roleColor, type SpaceRole} from "@app/members"

  type Props = {
    role: SpaceRole
    size?: "sm" | "md"
  }

  const {role, size = "sm"}: Props = $props()
</script>

<span
  class={cx("role-badge", size === "md" && "role-badge--md")}
  style="--role-color: {roleColor(role.color)}">
  <span class="role-badge__dot" aria-hidden="true"></span>
  {role.label || "Untitled Role"}
</span>
