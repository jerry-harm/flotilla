import {expect, roomPath, test, users} from "../harness"

test("delivers one user's message to another user's open page", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
  })

  const {url} = scenario.space("space")
  const path = roomPath(url, "general")

  // Two browser contexts, two identities, one relay: bob's page is already listening when alice
  // sends, so the message reaches him over the wire rather than out of a shared repository.
  const alice = await as(users.alice, path)
  const bob = await as(users.bob, path)

  await expect(bob.getByRole("link", {name: "General"})).toBeVisible()

  await alice.locator(".chat-editor [contenteditable=true]").pressSequentially("anyone there?")
  await alice.locator(".chat-editor [contenteditable=true]").press("Enter")

  await expect(alice.getByText("anyone there?")).toBeVisible()
  await expect(bob.getByText("anyone there?")).toBeVisible()
})
