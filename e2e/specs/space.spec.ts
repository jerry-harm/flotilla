import {HOUR, MINUTE} from "@welshman/lib"
import {expect, roomPath, test, users} from "../harness"

test("renders a seeded space, its rooms and its messages", async ({seed, as}) => {
  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.room("random", {name: "Random"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")
    space.message(user.bob, "general", "morning all", at(2, HOUR))
    space.message(user.alice, "general", "morning!", at(90, MINUTE))
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, roomPath(url, "general"))

  // The room the user belongs to and the one they don't are both advertised by the relay, so
  // both appear in the space menu.
  await expect(page.getByRole("link", {name: "General"})).toBeVisible()
  await expect(page.getByRole("link", {name: "Random"})).toBeVisible()

  await expect(page.getByText("morning all")).toBeVisible()
  await expect(page.getByText("morning!")).toBeVisible()
})
