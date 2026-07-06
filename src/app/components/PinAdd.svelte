<script lang="ts">
  import PinForm, {type PinFormValues} from "@app/components/PinForm.svelte"
  import {createPin, referenceToPin} from "@app/pinboards"

  type Props = {
    url: string
    address: string
    reference?: string
  }

  const {url, address, reference}: Props = $props()

  const submit = async ({title, topics, value, content}: PinFormValues) => {
    const params = referenceToPin(value)

    if (!params) return "Please enter a valid URL or nostr link."

    return createPin(url, {...params, boards: [address], title, topics, description: content})
  }
</script>

<PinForm
  {url}
  heading="Add Link"
  action="Add link"
  successMessage="Link added!"
  values={{value: reference}}
  {submit} />
