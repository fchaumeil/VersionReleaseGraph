import * as semver from "semver"
import type { AzureBuild } from "./azureDevOps"
import { ENV_PRIORITY, type Build, type Environment, type VersionNode } from "./types"

const ENV_TAG_RE = /^env:(dev|qa|preprod|prod)$/

function parseEnvironment(tags: string[]): Environment | null {
  for (const tag of tags) {
    const match = ENV_TAG_RE.exec(tag)
    if (match) return match[1] as Environment
  }
  return null
}

export function transformBuilds(rawBuilds: AzureBuild[]): VersionNode[] {
  const byVersion = new Map<string, Build[]>()

  for (const raw of rawBuilds) {
    const version = semver.valid(raw.buildNumber)
    if (!version) {
      console.warn(`Skipping build ${raw.id}: invalid semver "${raw.buildNumber}"`)
      continue
    }

    const environment = parseEnvironment(raw.tags ?? [])
    if (!environment) {
      console.warn(`Skipping build ${raw.id} (${version}): no env:* tag`)
      continue
    }

    const build: Build = {
      id: raw.id.toString(),
      version,
      environment,
      timestamp: raw.finishTime,
      buildUrl: raw._links.web.href,
      commitSha: raw.sourceVersion?.slice(0, 7) ?? "",
      tags: raw.tags ?? [],
      hasDbChanges: (raw.tags ?? []).includes("risk:db"),
      hasEnvChanges: (raw.tags ?? []).includes("risk:env"),
    }

    const existing = byVersion.get(version) ?? []
    existing.push(build)
    byVersion.set(version, existing)
  }

  const nodes: VersionNode[] = []

  for (const [version, builds] of byVersion) {
    const highestBuild = builds.reduce((best, b) =>
      ENV_PRIORITY[b.environment] > ENV_PRIORITY[best.environment] ? b : best
    )
    nodes.push({
      version,
      highestEnv: highestBuild.environment,
      build: highestBuild,
      allBuilds: builds,
    })
  }

  nodes.sort((a, b) => semver.compare(a.version, b.version))

  return nodes
}
