<script lang="ts">
  import ShieldMinimalistic from "@assets/icons/shield-minimalistic.svg?dataurl"
  import {preventDefault} from "@lib/html"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import ToggleInput from "@lib/components/ToggleInput.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Card from "@lib/components/Card.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {pushToast} from "@app/toast"
  import {PLATFORM_NAME} from "@app/env"
  import {sendLogs} from "@app/logger"
  import {
    RelayAuthMode,
    userSettingsValues,
    publishSettings,
    createSettingsForm,
  } from "@app/settings"

  const reset = () => {
    settings.set({...$userSettingsValues})
  }

  const send = async () => {
    loading = true

    try {
      const thunk = await sendLogs()
      const error = await thunk.waitForError()

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Your logs have been sent. Thank you!"})
      }
    } finally {
      loading = false
    }
  }

  const onAuthModeChange = (checked: boolean) => {
    $settings.relay_auth = checked ? RelayAuthMode.Aggressive : RelayAuthMode.Conservative
  }

  const onsubmit = preventDefault(async () => {
    await publishSettings($settings)

    pushToast({message: "Your settings have been saved!"})
  })

  const settings = createSettingsForm()
  let loading = $state(false)
</script>

<form {onsubmit}>
  <PageContent>
    <Card class="flex flex-col gap-4">
      <strong class="flex items-center gap-3 text-lg">
        <Icon icon={ShieldMinimalistic} />
        Privacy Settings
      </strong>
      <FieldInline>
        {#snippet label()}
          <p>Authenticate with unknown relays?</p>
        {/snippet}
        {#snippet input()}
          <ToggleInput
            checked={$settings.relay_auth === RelayAuthMode.Aggressive}
            onchange={onAuthModeChange} />
        {/snippet}
        {#snippet info()}
          <p>Controls whether {PLATFORM_NAME} will identify you to relays not in your lists.</p>
        {/snippet}
      </FieldInline>
      <FieldInline>
        {#snippet label()}
          <p>Something went wrong?</p>
        {/snippet}
        {#snippet input()}
          <Button class="button button-neutral" onclick={send} disabled={loading}>
            <Spinner {loading}>Send Logs</Spinner>
          </Button>
        {/snippet}
        {#snippet info()}
          <p>
            Send a record of recent app activity to the {PLATFORM_NAME} team as a direct message.
          </p>
        {/snippet}
      </FieldInline>
    </Card>
    <Card class="sticky -bottom-3 shadow-md flex flex-row items-center justify-between gap-4">
      <Button class="button button-neutral" onclick={reset}>Discard Changes</Button>
      <Button class="button button-primary" type="submit">Save Changes</Button>
    </Card>
  </PageContent>
</form>
