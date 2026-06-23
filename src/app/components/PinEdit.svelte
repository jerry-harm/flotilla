<script lang="ts">
  import PinForm, {type PinFormValues} from "@app/components/PinForm.svelte"
  import {createPin, referenceToPin, pinToReference, type Pin} from "@app/pinboards"

  type Props = {
    url: string
    pin: Pin
  }

  const {url, pin}: Props = $props()

  const submit = async ({title, topics, value}: PinFormValues) => {
    const params = referenceToPin(value)

    if (!params) return "Please enter a valid URL or nostr link."

    // Reuse the pin's identifier and boards so its addressable event is replaced.
    return createPin(url, {
      ...params,
      identifier: pin.identifier,
      boards: pin.boards,
      title,
      topics,
    })
  }
</script>

<PinForm
  {url}
  heading="Edit Link"
  action="Save changes"
  successMessage="Link updated!"
  values={{title: pin.title, topics: pin.topics, value: pinToReference(pin)}}
  {submit} />
