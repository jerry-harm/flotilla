import {execFile} from "node:child_process"
import {createConnection} from "node:net"
import {chmod, cp, readdir, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {fileURLToPath} from "node:url"
import {promisify} from "node:util"
import {MINUTE, int, ms, sleep} from "@welshman/lib"
import type {Maybe} from "@welshman/lib"
import {makeRelayAuth} from "@welshman/util"
import type {SignedEvent} from "@welshman/util"
import {ClientMessageType, isRelayAuth, isRelayOk} from "@welshman/net"
import type {ClientMessage} from "@welshman/net"
import {testUsersByPubkey} from "../keys"
import type {TestUser} from "../keys"
import {tenantNames, tenantUrl, tenants} from "./config"
import type {TenantName} from "./config"
import {makeTestRelay} from "./testRelay"
import type {PublishOptions} from "./types"
import {connectToZooid, requestZooid} from "./transport"
import type {ZooidConnection} from "./transport"

const image = "gitea.coracle.social/coracle/zooid:latest"

const composeFile = fileURLToPath(new URL("docker/compose.yaml", import.meta.url))

const configSource = fileURLToPath(new URL("docker/config", import.meta.url))

// What the container mounts as /app/config. zooid saves a relay's toml back whenever a nip-86 call
// edits that relay's name, description or icon, so it is handed a copy rather than the repo's own
// directory: a read-only mount fails those calls, and a writable one would leave the fixtures every
// other test reads rewritten by whatever the last one did. The copy is staged here rather than in
// an entrypoint because the image is distroless — there is no shell in it to copy anything with.
const configDir = join(tmpdir(), "flotilla-e2e-zooid-config")

const execFileAsync = promisify(execFile)

// execFile does not go through a shell, so a `docker` that exists only as an alias or a function —
// podman, colima, a wrapper in a shell rc file — is invisible to it however well it works when
// typed. Name the executable to drive with E2E_DOCKER in that case.
const dockerCommand = process.env.E2E_DOCKER ?? "docker"

// The loopback port the container publishes and transport.ts dials. It is fixed rather than
// configurable on purpose: the harness talks to whatever answers here, so a copy of the suite left
// running by anyone else on the machine — under another user, even — would be seeded, queried and
// reset out from under this run. Both places have to agree, so this must match the published port
// in docker/compose.yaml and `port` in transport.ts.
const relayHostPort = 3334

// Whether something already answers on the relay's loopback port. Used as a pre-flight: the port is
// the harness's alone for the length of a run, so anything holding it before this run brings its own
// container up is a foreign occupant we must refuse rather than quietly share.
const isRelayPortTaken = () =>
  new Promise<boolean>(resolve => {
    const socket = createConnection({port: relayHostPort, host: "127.0.0.1"})

    socket.setTimeout(1000)
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
    socket.once("error", () => resolve(false))
  })

// Every invocation carries ZOOID_CONFIG, `down` included: the compose file names it without a
// default, so a call that left it out would fail to interpolate rather than quietly mounting
// something else.
const docker = (...args: string[]) =>
  execFileAsync(dockerCommand, args, {env: {...process.env, ZOOID_CONFIG: configDir}})

const compose = (...args: string[]) => docker("compose", "-f", composeFile, ...args)

// Why the container cannot be driven, or undefined when it can. The two failures need different
// answers — a cli that is not on this process's PATH is usually a shell alias or an inherited
// environment, and telling someone to start docker sends them the wrong way — so they are reported
// apart rather than as one boolean.
const probeDocker = async () => {
  try {
    await docker("compose", "version")

    return undefined
  } catch (error) {
    const {code, stderr} = Object(error) as {code?: string; stderr?: string}

    if (code === "ENOENT") {
      return (
        `\`${dockerCommand}\` is not on PATH for the test runner. If it works in your shell it is ` +
        "an alias or a function rather than an executable, which execFile cannot see: set " +
        "E2E_DOCKER to the real command, e.g. `E2E_DOCKER=podman pnpm test`."
      )
    }

    return (
      `\`${dockerCommand} compose version\` failed, so the daemon is likely not running. ` +
      (stderr?.trim() || String(error))
    )
  }
}

// How far the container's clock is from this host's, in seconds, read off the Date header of the
// relay's own http answer. Positive means the container is behind, which is what makes an event the
// harness has just signed look like it comes from the future.
const getClockDrift = async (host: string) => {
  const {headers} = await requestZooid(host, "GET", "/", {accept: "application/nostr+json"})

  if (headers.date) {
    return Math.round((Date.now() - new Date(headers.date).getTime()) / 1000)
  }
}

// nip-42 accepts an auth event within ten minutes of the relay's own clock (nip42.go), and the two
// clocks here belong to different machines: the harness signs with this host's, the container
// validates with the vm's. A vm whose clock stopped while the machine slept is the usual reason
// they diverge, and the relay's own one-line detail says nothing about how to fix it.
const describeClockDrift = (drift: number) => {
  const [minutes, direction] =
    drift > 0 ? [drift / 60, "behind"] : [Math.abs(drift) / 60, "ahead of"]

  return (
    `The zooid container's clock is ${Math.round(minutes)} minutes ${direction} this host. ` +
    "nip-42 allows ten either way, so the relay refuses every event the harness signs, and " +
    "will go on refusing them until the two agree. A container runtime's vm loses time while " +
    "the machine is asleep; restarting it resyncs the clock:\n\n" +
    "  podman: podman machine stop && podman machine start\n" +
    "  docker: restart Docker Desktop, or " +
    "`docker run --rm --privileged alpine hwclock -s`\n\n" +
    "Then confirm they agree — `podman machine ssh date -u`, or " +
    "`docker info --format '{{.SystemTime}}'`, against `date -u`."
  )
}

const getTestUser = (pubkey: string) => {
  const user = testUsersByPubkey.get(pubkey)

  if (user) return user

  throw new Error(
    `Cannot publish as ${pubkey}: zooid authenticates every write, so seeded events must be ` +
      "signed by one of the test identities in e2e/harness/keys.ts",
  )
}

let problem: Maybe<Promise<Maybe<string>>>

// Asked once a worker: docker does not come and go mid-run, and the answer is also written to the
// terminal, because a skip reason otherwise reaches only the html report and a run that silently
// skips every test is the least useful thing this can do.
export const describeDockerProblem = () =>
  (problem ??= probeDocker().then(reason => {
    if (reason) {
      console.warn(
        `\nThe e2e suite cannot drive a container, so every test will skip:\n  ${reason}\n`,
      )
    }

    return reason
  }))

/**
 * The relay every test runs against: one zooid container on loopback, serving a virtual relay per
 * entry in `tenants`. Each relay's policy is whatever its toml in docker/config says, which is the
 * only place policy is written down — a scenario describes what is *on* a relay, never what the
 * relay is.
 */
export class Zooid {
  // Every socket into the container — the client's and seeding's alike — is one this process
  // opened, so this map is also the definition of a url that is not a leak.
  relays = new Map(
    tenantNames.map(name => [
      tenantUrl(name),
      {connect: () => connectToZooid(tenants[name]), host: tenants[name]},
    ]),
  )

  private sessions = new Map<string, ZooidConnection>()

  private started = false

  // Verifying docker rather than bringing the container up: every test resets, and that is what
  // starts it. Repeat calls are free, so the fixture can call this per test.
  start = async () => {
    if (this.started) return

    const problem = await describeDockerProblem()

    if (problem) {
      throw new Error(problem)
    }

    const hasImage = await docker("image", "inspect", image).then(
      () => true,
      () => false,
    )

    if (!hasImage) {
      throw new Error(
        `The zooid image ${image} is not present locally. Fetch it with ` +
          `\`${dockerCommand} pull ${image}\`, or build it from a zooid checkout with ` +
          `\`${dockerCommand} build -t ${image} .\`.`,
      )
    }

    // Nothing should answer on the relay port yet: this run has not brought its container up. If
    // something does, it is a leftover container from an aborted run or another copy of the suite —
    // and because the harness dials this fixed port, sharing it silently corrupts both runs. Refuse
    // loudly instead. `compose down` clears a leftover of this project's own.
    if (await isRelayPortTaken()) {
      throw new Error(
        `127.0.0.1:${relayHostPort} is already in use, but the zooid relay container publishes ` +
          "exactly that port and the harness talks to whatever answers there. This is a leftover " +
          "container from an interrupted run, or another copy of this suite running on the machine " +
          `(under any user). Free it before running — \`${dockerCommand} compose -f ` +
          "e2e/harness/zooid/docker/compose.yaml down\` clears one this project started.",
      )
    }

    this.started = true
  }

  relay = async (name: TenantName) =>
    makeTestRelay({
      name,
      url: tenantUrl(name),
      publish: (event, options) => this.publish(tenantUrl(name), event, options),
    })

  publish = async (url: string, event: SignedEvent, {as}: PublishOptions = {}) => {
    const relay = this.relays.get(url)

    if (!relay) {
      throw new Error(`Attempted to publish to ${url}, which is not one of this container's relays`)
    }

    const connection = await this.authenticate(relay.host, as ?? getTestUser(event.pubkey))
    const {ok, detail} = await this.send(connection, [ClientMessageType.Event, event], event.id)

    if (!ok) {
      throw new Error(`zooid refused a kind ${event.kind} fixture: ${detail}`)
    }
  }

  reset = async () => {
    this.closeSessions()

    await this.up()
  }

  stop = async () => {
    if (this.started) {
      this.closeSessions()

      await compose("down")

      this.started = false
    }
  }

  // Whatever the relay wrote before it died. Compose reports only that a container exited, so
  // without this a startup failure is a status code and no reason.
  private logs = () =>
    compose("logs", "--no-color", "--tail", "50").then(
      ({stdout, stderr}) => [stdout, stderr].filter(Boolean).join("\n").trim(),
      () => "",
    )

  private fail = async (summary: string) => {
    const logs = await this.logs()

    throw new Error(logs ? `${summary}\n\nzooid said:\n${logs}` : summary)
  }

  // Recreating rather than restarting is what makes this a reset: with storage in tmpfs and no
  // volume mounted for it, a new container is a new database.
  private up = async () => {
    // A fresh copy on every recreate is what makes a reset restore pristine relay metadata after a
    // test has edited some through nip-86. The modes are permissive because the container runs as
    // uid 65532 while the copy belongs to whoever ran the suite, and a runtime that keeps host
    // ownership — rootless podman, docker on linux — would otherwise leave zooid unable to write
    // the file it was told to save.
    await rm(configDir, {recursive: true, force: true})
    await cp(configSource, configDir, {recursive: true})
    await chmod(configDir, 0o777)

    for (const name of await readdir(configDir)) {
      await chmod(join(configDir, name), 0o666)
    }

    try {
      await compose("up", "-d", "--force-recreate", "--wait")
    } catch (error) {
      const {stderr} = Object(error) as {stderr?: string}

      await this.fail((stderr?.trim() || String(error)).split("\n").slice(-3).join("\n"))
    }

    const deadline = Date.now() + ms(30)

    while (Date.now() < deadline) {
      // A 404 means the dispatcher has no relay bound to that host yet, so the configs are still
      // loading. Anything a relay itself answers means every tenant is ready.
      const isUp = await Promise.all(
        tenantNames.map(name =>
          requestZooid(tenants[name], "GET", "/", {accept: "application/nostr+json"}).then(
            response => response.status === 200,
            () => false,
          ),
        ),
      ).then(results => results.every(Boolean))

      if (isUp) {
        const drift = await getClockDrift(tenants[tenantNames[0]])

        if (drift !== undefined && Math.abs(drift) > int(10, MINUTE)) {
          throw new Error(describeClockDrift(drift))
        }

        return
      }

      await sleep(200)
    }

    await this.fail(
      `zooid did not answer as ${tenantNames.map(name => tenants[name]).join(" and ")} within 30 ` +
        "seconds.",
    )
  }

  // NIP-42 binds an identity to a connection, so each test user seeds over its own, per relay. The
  // url signed into the auth event is the one the client uses, because that is the one khatru
  // rebuilds from the headers transport.ts sends — a fixture is written over the same relay the app
  // talks to.
  private authenticate = async (host: string, user: TestUser) => {
    const key = `${host} ${user.pubkey}`
    const session = this.sessions.get(key)

    if (session) return session

    const connection = connectToZooid(host)
    const [, challenge] = await connection.wait(isRelayAuth)
    const event = await user.signer.sign(makeRelayAuth(`wss://${host}/`, challenge))
    const {ok, detail} = await this.send(connection, [ClientMessageType.Auth, event], event.id)

    if (ok) {
      this.sessions.set(key, connection)

      return connection
    }

    const summary = `Failed to authenticate as ${user.name} on ${host}: ${detail}`
    const drift = await getClockDrift(host).catch(() => undefined)

    // Nearly always the clock rather than the key: every identity here is one zooid's toml names,
    // and the signature is checked last, after the timestamp the relay compares against its own.
    if (drift !== undefined && Math.abs(drift) > int(10, MINUTE)) {
      throw new Error(`${summary}\n\n${describeClockDrift(drift)}`)
    }

    throw new Error(summary)
  }

  // Both halves of seeding — the auth that opens a connection and every event written over it —
  // are answered with an OK naming the event that was sent.
  private send = async (connection: ZooidConnection, message: ClientMessage, id: string) => {
    connection.send(message)

    const [, , ok, detail] = await connection.wait(reply => isRelayOk(reply) && reply[1] === id)

    return {ok, detail}
  }

  private closeSessions = () => {
    for (const connection of this.sessions.values()) {
      connection.close()
    }

    this.sessions.clear()
  }
}
