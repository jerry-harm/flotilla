import {MINUTE} from "@welshman/lib"
import {RelayList} from "@welshman/domain"
import type {Locator, Page} from "@playwright/test"
import {expect, roomPath, test, users} from "../harness"
import type {SeededSpace, TestUser} from "../harness"

// A handle to a seeded event, which only reads once seed() has drained its queue.
type Seeded = {readonly id: string}

// The user's own relay list. Everything on these pages is published through their outbox, and the
// sync that loads their settings back after a reload hangs off this list, so a spec that saves a
// setting has to seed one.
const relayList = (space: SeededSpace, user: TestUser) =>
  space.event(user, () =>
    space
      .kind(RelayList)
      .writer()
      .setReadUrls([space.url])
      .setWriteUrls([space.url])
      .renderTemplate(),
  )

// FieldInline lays a labelled control out as a single row, with the label at one end and the
// control at the other.
const row = (page: Page, label: string) =>
  page.locator("div.items-center.justify-between").filter({hasText: label})

const toggle = (page: Page, label: string) => row(page, label).getByRole("checkbox")

// RelaySettingsItem renders one relay list as a button: its name and description at one end, a
// check or a danger triangle and the list's size at the other.
const relayRow = (page: Page, title: string) => page.getByRole("button").filter({hasText: title})

const relayCount = (page: Page, title: string) => relayRow(page, title).locator("div.justify-end")

// The check/warning icon beside that count. Icons are mask-image data urls, so which one is showing
// can only be read by comparing it against a row whose state is already known.
const relayIcon = (page: Page, title: string) =>
  relayRow(page, title).locator("div.inline-block").last().getAttribute("style")

// One relay list's modal, which carries the list's name as its heading. Dialog nests two elements
// with the class; the inner one holds the content.
const relayDialog = (page: Page, title: string) =>
  page
    .locator(".dialog")
    .filter({has: page.getByRole("heading", {name: title, exact: true})})
    .last()

// The relay picker, which has no heading of its own — and is pushed over the list modal rather
// than alongside it, so it is the only dialog in the dom while it is open.
const relayPicker = (page: Page) => page.locator(".dialog").last()

const relayCard = (scope: Locator, name: string) => scope.locator(".card").filter({hasText: name})

// RelaySettingsHealthCheck renders one issue as a small card with its recommendation beside it.
const issue = (page: Page, title: string) => page.locator(".card-sm").filter({hasText: title})

// A saved setting reaches indexeddb in batches, and a settings page reads its values once when it
// mounts — so a reload only sees the new value after the batch has been flushed. A toast clears
// itself after five seconds, which is longer than the batch window, so waiting it out is what
// makes the assertion that follows about persistence rather than about timing.
const waitForToastToClear = (page: Page) => expect(page.getByRole("alert")).toHaveCount(0)

test("US-083 manage inbox and outbox relays", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    // Kind 10002 publishes to every relay it names, and to the indexers, so alice has to be a
    // member of both of them for her own edits to be accepted.
    other.room("lounge", {name: "Lounge"})
    other.join(user.alice, "lounge")

    space.event(user.alice, () =>
      space
        .kind(RelayList)
        .writer()
        .setReadUrls([space.url])
        .setWriteUrls([space.url, other.url])
        .renderTemplate(),
    )
  })

  const page = await as(users.alice, "/settings/relays")

  await expect(relayRow(page, "Inbox Relays")).toBeVisible()
  await expect(relayRow(page, "Outbox Relays")).toBeVisible()
  await expect(relayCount(page, "Inbox Relays")).toHaveText("1")
  await expect(relayCount(page, "Outbox Relays")).toHaveText("2")

  // alice has no dm relays at all, so this row is the reference for what a warning looks like.
  const warningIcon = await relayIcon(page, "DM Relays")

  expect(await relayIcon(page, "Outbox Relays")).not.toBe(warningIcon)

  await relayRow(page, "Inbox Relays").click()

  const inbox = relayDialog(page, "Inbox Relays")

  await expect(inbox.getByText("space.test")).toBeVisible()
  await expect(inbox.getByText("other.test")).toHaveCount(0)

  await inbox.getByRole("button", {name: "Add Relays"}).click()
  await page.getByPlaceholder("Search for relays...").fill("other.test")

  // The typed url is offered as a custom entry alongside whatever the picker already knows about,
  // and both add the same relay.
  await relayPicker(page).getByRole("button", {name: "Add Relay"}).first().click()

  await expect(relayPicker(page).getByRole("button", {name: "Add Relay"})).toHaveCount(0)

  await page.getByRole("button", {name: "Done"}).click()

  await expect(relayDialog(page, "Inbox Relays").getByText("other.test")).toBeVisible()

  await relayDialog(page, "Inbox Relays").getByRole("button", {name: "Go back"}).click()

  await expect(relayCount(page, "Inbox Relays")).toHaveText("2")

  await relayRow(page, "Outbox Relays").click()

  const outbox = relayDialog(page, "Outbox Relays")

  await relayCard(outbox, "other.test").getByRole("button", {name: "Remove"}).click()

  await expect(outbox.getByText("space.test")).toBeVisible()
  await expect(outbox.getByText("other.test")).toHaveCount(0)

  await outbox.getByRole("button", {name: "Go back"}).click()

  await expect(relayCount(page, "Outbox Relays")).toHaveText("1")

  expect(await relayIcon(page, "Outbox Relays")).toBe(warningIcon)
})

test("US-084 manage DM, search, and blocked relays", async ({seed, as}) => {
  const scenario = await seed(({relay, user}) => {
    const space = relay("space")

    // A second relay for the pickers to offer. Nobody is a member of it — what puts a relay in
    // the suggestion pool is its nip-11 document having been fetched, and every scenario relay is
    // an indexer, so bob's client reads this one at startup.
    relay("other")

    space.room("general", {name: "General"})
    space.join(user.bob, "general")

    relayList(space, user.bob)
  })

  const other = scenario.space("other")
  const page = await as(users.bob, "/settings/relays", {
    // zooid advertises no nip-50, and the search-relay picker offers nothing that doesn't.
    relayInfo: {[other.url]: {supported_nips: ["1", "29", "43", "50"]}},
  })

  await expect(relayCount(page, "DM Relays")).toHaveText("0")
  await expect(relayCount(page, "Search Relays")).toHaveText("0")

  await relayRow(page, "DM Relays").click()
  await relayDialog(page, "DM Relays").getByRole("button", {name: "Add Relays"}).click()
  await relayCard(relayPicker(page), "space.test").getByRole("button", {name: "Add Relay"}).click()
  await page.getByRole("button", {name: "Done"}).click()

  const dms = relayDialog(page, "DM Relays")

  await expect(dms.getByText("space.test")).toBeVisible()

  await dms.getByRole("button", {name: "Go back"}).click()

  await expect(relayCount(page, "DM Relays")).toHaveText("1")

  // The same relay is not now a search relay: the two lists are separate.
  await relayRow(page, "Search Relays").click()

  const search = relayDialog(page, "Search Relays")

  await expect(search.getByText("No relay selections found.")).toBeVisible()
  await expect(search.getByText("space.test")).toHaveCount(0)

  await search.getByRole("button", {name: "Add Relays"}).click()

  // Only the relay advertising nip-50 is on offer.
  await expect(relayPicker(page).getByText("other.test")).toBeVisible()
  await expect(relayPicker(page).getByText("space.test")).toHaveCount(0)
  await expect(relayPicker(page).getByRole("button", {name: "Add Relay"})).toHaveCount(1)

  await relayPicker(page).getByRole("button", {name: "Add Relay"}).click()
  await page.getByRole("button", {name: "Done"}).click()
  await relayDialog(page, "Search Relays").getByRole("button", {name: "Go back"}).click()

  await expect(relayCount(page, "Search Relays")).toHaveText("1")

  await relayRow(page, "Search Relays").click()
  await relayCard(relayDialog(page, "Search Relays"), "other.test")
    .getByRole("button", {name: "Remove"})
    .click()
  await relayDialog(page, "Search Relays").getByRole("button", {name: "Go back"}).click()

  await expect(relayCount(page, "Search Relays")).toHaveText("0")

  await relayRow(page, "Blocked Relays").click()
  await relayDialog(page, "Blocked Relays").getByRole("button", {name: "Add Relays"}).click()
  await relayCard(relayPicker(page), "other.test").getByRole("button", {name: "Add Relay"}).click()
  await page.getByRole("button", {name: "Done"}).click()

  const blocked = relayDialog(page, "Blocked Relays")

  await expect(blocked.getByText("other.test")).toBeVisible()

  await blocked.getByRole("button", {name: "Go back"}).click()

  await expect(relayCount(page, "Blocked Relays")).toHaveText("1")

  // A blocked relay is one bob never wants used, so the other lists stop suggesting it. The search
  // picker offered other.test and nothing else a moment ago, which is what makes its absence here
  // a statement about blocking rather than about an empty picker.
  await relayRow(page, "Search Relays").click()
  await relayDialog(page, "Search Relays").getByRole("button", {name: "Add Relays"}).click()

  await expect(relayPicker(page).getByPlaceholder("Search for relays...")).toBeVisible()
  await expect(relayPicker(page).getByText("other.test")).toHaveCount(0)
  await expect(relayPicker(page).getByRole("button", {name: "Add Relay"})).toHaveCount(0)
})

test("US-085 fix relay misconfiguration from the health check", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")
    const other = relay("other")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    // A recommendation writes the platform's default relays into the list, which is both of the
    // scenario's, so alice has to be a member of both for the new list to be accepted.
    other.room("lounge", {name: "Lounge"})
    other.join(user.alice, "lounge")

    relayList(space, user.alice)
  })

  const page = await as(users.alice, "/settings/relays")

  // Exact, because "3 Issues Detected" is also a substring of "13 Issues Detected".
  await expect(page.getByText("3 Issues Detected", {exact: true})).toBeVisible()
  await expect(issue(page, "Missing Outbox Relays")).toBeVisible()
  await expect(relayCount(page, "Outbox Relays")).toHaveText("1")

  await issue(page, "Missing Outbox Relays").getByRole("button", {name: "Update"}).click()

  await expect(relayCount(page, "Outbox Relays")).toHaveText("2")
  await expect(issue(page, "Missing Outbox Relays")).toHaveCount(0)
  await expect(page.getByText("2 Issues Detected", {exact: true})).toBeVisible()

  await page.getByRole("button", {name: "Apply All Recommendations"}).click()

  await expect(page.getByText("0 Issues Detected", {exact: true})).toBeVisible()
  await expect(page.getByRole("button", {name: "Apply All Recommendations"})).toHaveCount(0)
})

test("US-086 configure alerts", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    relayList(space, user.alice)
  })

  const page = await as(users.alice, "/settings/alerts")

  const sound = toggle(page, "Play sound for new activity")
  const push = toggle(page, "Enable push notifications")
  const alertTypes = page.locator("div.card").filter({has: page.getByText("Alert Types")})

  await expect(sound).toBeChecked()
  await expect(push).not.toBeChecked()
  await expect(alertTypes).not.toHaveClass(/opacity-50/)

  // With nothing left to be alerted through, there is nothing to be alerted about.
  await sound.uncheck()

  await expect(alertTypes).toHaveClass(/opacity-50/)

  await page.getByRole("button", {name: "Discard Changes"}).click()

  await expect(sound).toBeChecked()
  await expect(alertTypes).not.toHaveClass(/opacity-50/)

  // Push asks the browser for permission, and this context was never granted it.
  await push.check()
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Failed to request notification permissions")
  await expect(push).not.toBeChecked()
  await expect(sound).toBeChecked()

  await waitForToastToClear(page)

  await sound.uncheck()
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await waitForToastToClear(page)
  await page.reload()

  await expect(toggle(page, "Play sound for new activity")).not.toBeChecked()
})

test("US-087 configure content display", async ({seed, as}) => {
  let picture!: Seeded
  let link!: Seeded

  const scenario = await seed(({relay, user, at}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.join(user.bob, "general")

    picture = space.message(user.bob, "general", "https://images.test/sunset.png", at(40, MINUTE))
    link = space.message(user.bob, "general", "https://example.test/announcement", at(35, MINUTE))

    relayList(space, user.alice)
  })

  const {url} = scenario.space("space")
  const page = await as(users.alice, "/settings/content")

  const hideSensitive = toggle(page, "Hide sensitive content?")
  const showMedia = toggle(page, "Show media?")

  await expect(hideSensitive).toBeChecked()
  await expect(showMedia).toBeChecked()

  await hideSensitive.uncheck()
  await showMedia.uncheck()
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await waitForToastToClear(page)
  await page.goto(roomPath(url, "general"))

  const pictureMessage = page.locator(`[data-event="${picture.id}"]`)
  const linkMessage = page.locator(`[data-event="${link.id}"]`)

  await expect(pictureMessage.getByRole("link", {name: "images.test/sunset.png"})).toBeVisible()
  await expect(pictureMessage.locator('img[src="https://images.test/sunset.png"]')).toHaveCount(0)

  await expect(linkMessage.getByRole("link", {name: "example.test/announcement"})).toBeVisible()
  await expect(linkMessage.locator(".spinner")).toHaveCount(0)
  await expect(linkMessage.getByText("Unable to load a preview")).toHaveCount(0)

  await page.goto("/settings/content")

  await expect(toggle(page, "Hide sensitive content?")).not.toBeChecked()
})

test("US-088 adjust send delay and media servers", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    relayList(space, user.alice)
  })

  const page = await as(users.alice, "/settings/content")

  // The send delay is the only slider on this page.
  const sendDelay = page.locator('input[type="range"]')
  const servers = page.getByRole("listitem")

  await expect(page.getByText("Delay sending chat messages for 0 seconds.")).toBeVisible()

  await sendDelay.fill("3000")

  await expect(page.getByText("Delay sending chat messages for 3 seconds.")).toBeVisible()

  await expect(servers).toHaveCount(0)

  await page.getByRole("button", {name: "Add Server"}).click()

  await expect(servers).toHaveCount(1)

  await servers.first().locator("input").fill("https://media.test/")

  await page.getByRole("button", {name: "Add Server"}).click()

  await expect(servers).toHaveCount(2)

  // Each row leads with its own remove button; the drag handle is the one with a label.
  await servers.nth(1).getByRole("button").first().click()

  await expect(servers).toHaveCount(1)
  await expect(servers.first().locator("input")).toHaveValue("https://media.test/")

  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await waitForToastToClear(page)
  await page.reload()

  await expect(page.getByText("Delay sending chat messages for 3 seconds.")).toBeVisible()
  await expect(page.locator('input[type="range"]')).toHaveValue("3000")
})

test("US-089 configure privacy preferences", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    relayList(space, user.alice)
  })

  const page = await as(users.alice, "/settings/privacy")

  const auth = toggle(page, "Authenticate with unknown relays?")
  const usage = toggle(page, "Report usage?")

  await expect(auth).not.toBeChecked()
  await expect(usage).toBeChecked()

  await auth.check()
  await usage.uncheck()
  await page.getByRole("button", {name: "Discard Changes"}).click()

  await expect(auth).not.toBeChecked()
  await expect(usage).toBeChecked()

  await auth.check()
  await usage.uncheck()
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your settings have been saved!")

  await waitForToastToClear(page)
  await page.reload()

  await expect(toggle(page, "Authenticate with unknown relays?")).toBeChecked()
  await expect(toggle(page, "Report usage?")).not.toBeChecked()
})

test("US-090 change the app's appearance", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")

    relayList(space, user.alice)
  })

  const page = await as(users.alice, "/settings/theme", {context: {colorScheme: "light"}})
  const body = page.locator("body")

  await expect(body).toHaveAttribute("data-theme", "light")

  await page.getByRole("button", {name: "Dark", exact: true}).click()

  await expect(body).toHaveAttribute("data-theme", "dark")

  await page.getByRole("button", {name: "System", exact: true}).click()

  await expect(body).toHaveAttribute("data-theme", "light")

  // System means the device's, so changing the device's changes the app's.
  await page.emulateMedia({colorScheme: "dark"})

  await expect(body).toHaveAttribute("data-theme", "dark")

  await page.getByLabel("Style").selectOption("navy")

  await expect(body).toHaveAttribute("data-fl-theme", "navy")

  await page.reload()

  await expect(body).toHaveAttribute("data-fl-theme", "navy")
  await expect(page.getByLabel("Style")).toHaveValue("navy")

  // Font size is the only slider on this page, and the only setting here that is published.
  const fontSize = page.locator('input[type="range"]')

  await expect(page.getByText("110%")).toBeVisible()
  await expect(page.getByRole("button", {name: "Save Changes"})).toHaveCount(0)

  await fontSize.fill("1.25")

  await expect(page.getByText("125%")).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("style", /font-size:\s*1\.25rem/)

  // Moving the slider is the save, so the size the document is rendered at survives a reload
  // without anything else having been pressed.
  await page.reload()

  await expect(page.locator("html")).toHaveAttribute("style", /font-size:\s*1\.25rem/)
})

test("US-091 set up how people zap you", async ({seed, as}) => {
  await seed(({relay, user}) => {
    const space = relay("space")

    space.room("general", {name: "General"})
    space.join(user.alice, "general")
    space.profile(user.alice, {name: "Alice Anders"})

    relayList(space, user.alice)
  })

  const page = await as(users.alice, "/settings/wallet")

  await expect(page.getByText("Not set")).toBeVisible()

  await page.getByRole("button", {name: "Update"}).click()

  const address = page
    .locator(".dialog")
    .filter({has: page.getByRole("heading", {name: "Update Lightning Address"})})
    .last()

  await address.getByPlaceholder("user@domain.com").fill("alice@example.test")
  await address.getByRole("button", {name: "Save Changes"}).click()

  // The dialog closes itself once the profile has gone out, and the page behind it carries its own
  // "Save Changes" — so wait it out rather than leaving that name ambiguous.
  await expect(address).toHaveCount(0)
  await expect(page.getByText("alice@example.test")).toBeVisible()
  await expect(page.getByText("Not set")).toHaveCount(0)

  await page.getByRole("button", {name: "Update"}).click()
  await address.getByPlaceholder("user@domain.com").fill("")
  await address.getByRole("button", {name: "Save Changes"}).click()

  await expect(address).toHaveCount(0)
  await expect(page.getByText("Not set")).toBeVisible()

  // Each preset is a row with a remove button and an amount input. The same utility classes land on
  // other rows (a button's spinner), so pin it to the zap-amounts form's rows that hold an input.
  const zapForm = page.locator("form").filter({hasText: "Zap Amounts"})
  const presets = zapForm.locator("div.items-center.gap-2:has(input)")

  await expect(presets).toHaveCount(4)

  await page.getByRole("button", {name: "Add amount"}).click()

  await expect(presets).toHaveCount(5)

  // A preset has to be worth something, so saving a zero is refused with an error.
  await presets.nth(4).locator("input").fill("0")
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Zap amounts must be greater than zero.")

  await waitForToastToClear(page)

  // Discarding puts back the last saved values, which are still alice's original four — the zero
  // never reached them.
  await page.getByRole("button", {name: "Discard Changes"}).click()

  await expect(presets).toHaveCount(4)

  await presets.nth(3).getByRole("button").click()
  await presets.nth(2).getByRole("button").click()
  await presets.nth(1).getByRole("button").click()

  await expect(presets).toHaveCount(1)
  await expect(presets.first().getByRole("button")).toBeDisabled()

  await presets.first().locator("input").fill("500")
  await page.getByRole("button", {name: "Save Changes"}).click()

  await expect(page.getByRole("alert")).toContainText("Your zap amounts have been saved!")

  await waitForToastToClear(page)
  await page.reload()

  const saved = page
    .locator("form")
    .filter({hasText: "Zap Amounts"})
    .locator("div.items-center.gap-2:has(input)")

  await expect(saved).toHaveCount(1)
  await expect(saved.first().locator("input")).toHaveValue("500")
})
