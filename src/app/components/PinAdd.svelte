<script lang="ts">
  import {Pin} from "@welshman/domain"
  import {publishAsRelay} from "@welshman/app"
  import PinForm, {type PinFormValues} from "@app/components/PinForm.svelte"
  import {command, writer} from "@app/core"
  import {setPinReference} from "@app/pinboards"

  type Props = {
    url: string
    address: string
    reference?: string
  }

  const {url, address, reference}: Props = $props()

  const submit = async ({title, topics, value, content}: PinFormValues) => {
    const eventWriter = writer(Pin).setIdentifier().addBoard(address)

    if (!setPinReference(eventWriter, value)) {
      return "Please enter a valid URL or nostr link."
    }

    eventWriter.setTitle(title).setTopics(topics).setContent(content)

    const thunk = await command(eventWriter).then(publishAsRelay(url))

    return thunk.waitForError()
  }
</script>

<PinForm
  {url}
  heading="Add Link"
  action="Add link"
  successMessage="Link added!"
  values={{value: reference}}
  {submit} />
