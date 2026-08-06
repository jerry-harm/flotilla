import {spec} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import {RelayMessageType} from "@welshman/net"
import {expect, getTranscript, roomPath, test, users} from "../harness"

test("keeps two spaces' contents on their own relays", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    // Same room id on both relays, so anything that keys rooms by id alone conflates them.
    space.room("lounge", {name: "Space Lounge"})
    other.room("lounge", {name: "Other Lounge"})
    space.join(user.alice, "lounge")
    other.join(user.alice, "lounge")
    space.message(user.alice, "lounge", "only in space")
    other.message(user.alice, "lounge", "only in other")
  })

  const space = scenario.space("space")
  const other = scenario.space("other")
  const page = await as(users.alice, roomPath(space.url, "lounge"))

  const deliveredByOther = (match: (event: TrustedEvent) => boolean) =>
    getTranscript(page.context()).some(
      ({url, direction, message}) =>
        url === other.url &&
        direction === "toClient" &&
        message[0] === RelayMessageType.Event &&
        match(message[2]),
    )

  await expect(page.getByText("only in space")).toBeVisible()
  await expect(page.getByRole("link", {name: "Space Lounge"})).toBeVisible()

  // Alice belongs to both spaces, so the client is talking to the other relay at the same time —
  // its room and its messages just don't belong in this one. It syncs independently, so wait until
  // both have actually reached this page: `toHaveCount(0)` is equally satisfied by an element that
  // has not loaded yet, which would pass against a client that does conflate them.
  await expect.poll(() => deliveredByOther(event => event.content === "only in other")).toBe(true)
  await expect
    .poll(() => deliveredByOther(event => event.tags.some(spec(["name", "Other Lounge"]))))
    .toBe(true)

  await expect(page.getByText("only in other")).toHaveCount(0)
  await expect(page.getByRole("link", {name: "Other Lounge"})).toHaveCount(0)

  const strays = getTranscript(page.context()).filter(
    ({url, direction, message}) =>
      direction === "toClient" &&
      message[0] === RelayMessageType.Event &&
      message[2].content === "only in space" &&
      url !== space.url,
  )

  expect(strays).toEqual([])
})
