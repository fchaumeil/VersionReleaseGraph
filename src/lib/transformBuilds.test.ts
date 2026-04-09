import { describe, it, expect, vi, beforeEach } from "vitest"
import { transformBuilds } from "./transformBuilds"
import type { AzureBuild } from "./azureDevOps"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function build(
  id: number,
  buildNumber: string,
  tags: string[],
  finishTime = "2024-01-01T00:00:00Z",
  sourceVersion = "abc1234def5678901234567890123456789012ab"
): AzureBuild {
  return {
    id,
    buildNumber,
    tags,
    finishTime,
    sourceVersion,
    _links: { web: { href: `https://dev.azure.com/mock/_build/results?buildId=${id}` } },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("transformBuilds", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  // Epic 7.1
  it("shows dev when version has only reached dev", () => {
    const result = transformBuilds([build(1, "1.0.0", ["env:dev"])])
    expect(result).toHaveLength(1)
    expect(result[0].highestEnv).toBe("dev")
  })

  // Epic 7.2
  it("shows qa when version has reached dev and qa", () => {
    const result = transformBuilds([
      build(1, "1.0.0", ["env:dev"]),
      build(2, "1.0.0", ["env:qa"]),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].highestEnv).toBe("qa")
  })

  // Epic 7.3
  it("shows prod when version has reached all environments", () => {
    const result = transformBuilds([
      build(1, "1.0.0", ["env:dev"]),
      build(2, "1.0.0", ["env:qa"]),
      build(3, "1.0.0", ["env:preprod"]),
      build(4, "1.0.0", ["env:prod"]),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].highestEnv).toBe("prod")
  })

  // Epic 7.4
  it("shows prod when version skipped qa/preprod (dev → prod gap)", () => {
    const result = transformBuilds([
      build(1, "1.0.0", ["env:dev"]),
      build(2, "1.0.0", ["env:prod"]),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].highestEnv).toBe("prod")
  })

  // Epic 7.5
  it("skips builds with invalid semver and warns", () => {
    const result = transformBuilds([
      build(1, "not-a-version", ["env:dev"]),
      build(2, "1.0.0", ["env:dev"]),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].version).toBe("1.0.0")
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("invalid semver")
    )
  })

  // Epic 7.6
  it("skips builds with no env:* tag and warns", () => {
    const result = transformBuilds([
      build(1, "1.0.0", []),
      build(2, "1.1.0", ["env:qa"]),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].version).toBe("1.1.0")
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("no env:* tag")
    )
  })

  it("sorts versions ascending by semver", () => {
    const result = transformBuilds([
      build(1, "1.3.0", ["env:dev"]),
      build(2, "1.1.0", ["env:prod"]),
      build(3, "1.10.0", ["env:qa"]),
      build(4, "1.2.0", ["env:preprod"]),
    ])
    expect(result.map((n) => n.version)).toEqual(["1.1.0", "1.2.0", "1.3.0", "1.10.0"])
  })

  it("extracts risk:db flag", () => {
    const result = transformBuilds([build(1, "1.0.0", ["env:prod", "risk:db"])])
    expect(result[0].build.hasDbChanges).toBe(true)
    expect(result[0].build.hasEnvChanges).toBe(false)
  })

  it("extracts risk:env flag", () => {
    const result = transformBuilds([build(1, "1.0.0", ["env:prod", "risk:env"])])
    expect(result[0].build.hasDbChanges).toBe(false)
    expect(result[0].build.hasEnvChanges).toBe(true)
  })

  it("attaches all builds to allBuilds for a version", () => {
    const result = transformBuilds([
      build(1, "1.0.0", ["env:dev"]),
      build(2, "1.0.0", ["env:qa"]),
      build(3, "1.0.0", ["env:prod"]),
    ])
    expect(result[0].allBuilds).toHaveLength(3)
    const envs = result[0].allBuilds.map((b) => b.environment).sort()
    expect(envs).toEqual(["dev", "prod", "qa"])
  })

  it("returns the build that reached the highest env as the representative build", () => {
    const result = transformBuilds([
      build(1, "1.0.0", ["env:dev"]),
      build(99, "1.0.0", ["env:prod"]),
    ])
    expect(result[0].build.id).toBe("99")
  })

  it("trims commit SHA to 7 characters", () => {
    const result = transformBuilds([build(1, "1.0.0", ["env:dev"])])
    expect(result[0].build.commitSha).toBe("abc1234")
  })

  it("handles builds from multiple pipelines merged together", () => {
    const pipeline101 = [
      build(1, "1.0.0", ["env:dev"]),
      build(2, "1.0.0", ["env:qa"]),
    ]
    const pipeline102 = [
      build(3, "1.0.0", ["env:prod"]),
      build(4, "2.0.0", ["env:dev"]),
    ]
    const result = transformBuilds([...pipeline101, ...pipeline102])
    expect(result).toHaveLength(2)
    expect(result[0].highestEnv).toBe("prod")  // 1.0.0 → prod
    expect(result[1].highestEnv).toBe("dev")   // 2.0.0 → dev
  })

  it("returns empty array for empty input", () => {
    expect(transformBuilds([])).toEqual([])
  })

  it("ignores unrecognised env:* values", () => {
    const result = transformBuilds([build(1, "1.0.0", ["env:staging"])])
    expect(result).toHaveLength(0)
    expect(console.warn).toHaveBeenCalled()
  })
})
