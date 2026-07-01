<script module lang="ts">
  import type {SpaceRole, SpaceRoleColor} from "@app/members"

  export type Values = Pick<SpaceRole, "label" | "description" | "color">
</script>

<script lang="ts">
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {roleColor} from "@app/members"

  type Props = {
    initialValues?: Partial<Values>
    loading?: boolean
    onSubmit: (values: Values) => void
  }

  const {initialValues = {}, loading = false, onSubmit}: Props = $props()

  const values = $state({
    label: initialValues.label ?? "",
    description: initialValues.description ?? "",
  })

  // Preserve any unedited components from the existing color; the form edits hue and lightness.
  const baseColor: SpaceRoleColor = {
    hue: "",
    saturation: "",
    lightness: "",
    ...initialValues.color,
  }

  const initialHue = parseInt(baseColor.hue, 10)
  const initialLightness = parseFloat(baseColor.lightness)

  let hue = $state(isNaN(initialHue) ? Math.floor(Math.random() * 360) : initialHue)
  let lightness = $state(isNaN(initialLightness) ? 0.5 : initialLightness)

  const color = $derived<SpaceRoleColor>({
    ...baseColor,
    hue: String(hue),
    lightness: String(lightness),
  })

  const back = () => history.back()

  const submit = () => onSubmit({...values, color})
</script>

<div class="flex flex-col gap-4">
  <Field>
    {#snippet label()}
      <p>Name</p>
    {/snippet}
    {#snippet input()}
      <input bind:value={values.label} class="input w-full" placeholder="Moderator" />
    {/snippet}
  </Field>
  <Field>
    {#snippet label()}
      <p>Description</p>
    {/snippet}
    {#snippet input()}
      <textarea bind:value={values.description} class="textarea input w-full" rows="2"></textarea>
    {/snippet}
  </Field>
  <Field>
    {#snippet label()}
      <p>Color</p>
    {/snippet}
    {#snippet input()}
      <div class="flex items-center gap-3">
        <div
          class="h-8 w-8 shrink-0 rounded-full border-2"
          style="background-color: {roleColor(color)}; border-color: var(--line)">
        </div>
        <div class="flex grow flex-col gap-2">
          <input
            type="range"
            min="0"
            max="360"
            bind:value={hue}
            class="range"
            style="color: {roleColor(color)}; --range-shdw: {roleColor(color)}" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            bind:value={lightness}
            class="range"
            style="color: {roleColor(color)}; --range-shdw: {roleColor(color)}" />
        </div>
      </div>
    {/snippet}
  </Field>
</div>
<ModalFooter>
  <Button class="button button-link" onclick={back}>
    <Icon icon={AltArrowLeft} />
    Go back
  </Button>
  <Button class="button button-primary" onclick={submit} disabled={loading || !values.label}>
    <Spinner {loading}>Save changes</Spinner>
  </Button>
</ModalFooter>
