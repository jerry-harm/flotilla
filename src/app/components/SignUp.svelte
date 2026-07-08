<script lang="ts">
  import cx from "classnames"
  import type {ClientOptions} from "@pomade/core"
  import type {Profile} from "@welshman/util"
  import {
    makeProfile,
    makeSecret,
    RELAYS,
    PROFILE,
    MESSAGING_RELAYS,
    makeEvent,
    createProfile,
  } from "@welshman/util"
  import {loginWithNip01, publishThunk, waitForThunkCompletion} from "@welshman/app"
  import Key from "@assets/icons/key-minimalistic.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import {getKey, setKey} from "@lib/implicit"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import LogIn from "@app/components/LogIn.svelte"
  import SignUpKey from "@app/components/SignUpKey.svelte"
  import SignUpEmail from "@app/components/SignUpEmail.svelte"
  import SignUpProfile from "@app/components/SignUpProfile.svelte"
  import SignUpComplete from "@app/components/SignUpComplete.svelte"
  import {attemptRelayAccess} from "@app/relays"
  import {
    POMADE_SIGNERS,
    PLATFORM_NAME,
    INDEXER_RELAYS,
    DEFAULT_RELAYS,
    DEFAULT_MESSAGING_RELAYS,
    DEFAULT_SPACES,
  } from "@app/env"
  import {setChecked} from "@app/notifications"
  import {setSpaces} from "@app/groups"
  import {loginWithPomade} from "@app/pomade"
  import {pushModal, clearModals} from "@app/modal"

  setKey("signup.email", "")
  setKey("signup.secret", makeSecret())
  setKey("signup.profile", makeProfile())
  setKey("signup.clientOptions", undefined)

  const hasPomade = POMADE_SIGNERS.length >= 3

  const login = () => pushModal(LogIn)

  const completeSignup = async () => {
    // Add default outbox/inbox/messaging relays, profile, spaces
    const thunks = await Promise.all([
      publishThunk({
        event: makeEvent(RELAYS, {tags: DEFAULT_RELAYS.map(url => ["r", url])}),
        relays: [...INDEXER_RELAYS, ...DEFAULT_RELAYS, ...DEFAULT_SPACES],
      }),
      publishThunk({
        event: makeEvent(MESSAGING_RELAYS, {tags: DEFAULT_MESSAGING_RELAYS.map(url => ["r", url])}),
        relays: [...DEFAULT_RELAYS, ...DEFAULT_SPACES],
      }),
      publishThunk({
        event: makeEvent(PROFILE, createProfile(getKey<Profile>("signup.profile")!)),
        relays: [...DEFAULT_RELAYS, ...DEFAULT_SPACES],
      }),
      setSpaces(DEFAULT_SPACES),
    ])

    // Wait for all the thunks to complete
    await Promise.all(thunks.map(waitForThunkCompletion))

    // Don't show any notifications for old content
    setChecked("*")

    // Go to the dashboard
    clearModals()
  }

  const flows = {
    email: {
      start: () => pushModal(SignUpEmail, {next: flows.email.profile, step: 1, totalSteps: 3}),
      profile: () => pushModal(SignUpProfile, {next: flows.email.complete, step: 2, totalSteps: 3}),
      complete: () =>
        pushModal(SignUpComplete, {next: flows.email.finalize, step: 3, totalSteps: 3}),
      finalize: async () => {
        const email = getKey<string>("signup.email")!
        const clientOptions = getKey<ClientOptions>("signup.clientOptions")!

        loginWithPomade(clientOptions, email)
        await completeSignup()
      },
    },
    nostr: {
      start: () => pushModal(SignUpProfile, {next: flows.nostr.key, step: 1, totalSteps: 3}),
      key: () => pushModal(SignUpKey, {next: flows.nostr.complete, step: 2, totalSteps: 3}),
      complete: () =>
        pushModal(SignUpComplete, {next: flows.nostr.finalize, step: 3, totalSteps: 3}),
      finalize: async () => {
        const secret = getKey<string>("signup.secret")!

        loginWithNip01(secret)
        await completeSignup()
      },
    },
  }
</script>

<Modal>
  <ModalBody>
    <h1 class="heading">Join {PLATFORM_NAME}</h1>
    <p class="m-auto max-w-sm text-center">
      Censorship resistant digital spaces for communities. Meet new people, own your identity.
    </p>
    {#if hasPomade}
      <Button onclick={flows.email.start} class="button button-primary">
        <Icon icon={Letter} />
        Sign up with email
      </Button>
    {/if}
    <Button
      onclick={flows.nostr.start}
      class={cx(`button button-${hasPomade ? "neutral" : "primary"}`)}>
      <Icon icon={Key} />
      Generate a key
    </Button>
    <div class="text-sm">
      Already have an account?
      <Button class="link" onclick={login}>Log in instead</Button>
    </div>
  </ModalBody>
</Modal>
