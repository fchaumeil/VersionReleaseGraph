import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { VersionNodeComponent } from "./VersionNode"
import type { VersionNode } from "../lib/types"

// Epic 4.2 — Custom VersionNode component
// Epic 4.3 — Environment badge colours
// Epic 4.4 — DB / env-var warning indicators

vi.mock("@xyflow/react", () => ({
  Handle: ({ type }: { type: string }) => <div data-testid={`handle-${type}`} />,
  Position: { Top: "top", Bottom: "bottom" },
}))

function makeNode(overrides: Partial<VersionNode["build"]> = {}): VersionNode {
  const build = {
    id: "1",
    version: "1.2.3",
    environment: "qa" as const,
    timestamp: "2024-03-15T14:32:00Z",
    buildUrl: "https://dev.azure.com/mock/_build/results?buildId=1",
    commitSha: "abc1234",
    tags: ["env:qa"],
    hasDbChanges: false,
    hasEnvChanges: false,
    ...overrides,
  }
  return {
    version: build.version,
    highestEnv: build.environment,
    build,
    allBuilds: [build],
  }
}

function renderNode(node: VersionNode, onClick = vi.fn()) {
  return render(<VersionNodeComponent data={{ versionNode: node, onClick }} />)
}

describe("VersionNodeComponent", () => {
  it("renders the version number", () => {
    renderNode(makeNode())
    expect(screen.getByText("1.2.3")).toBeInTheDocument()
  })

  it("renders the environment badge", () => {
    renderNode(makeNode())
    expect(screen.getByText("qa")).toBeInTheDocument()
  })

  it("renders target and source handles", () => {
    renderNode(makeNode())
    expect(screen.getByTestId("handle-target")).toBeInTheDocument()
    expect(screen.getByTestId("handle-source")).toBeInTheDocument()
  })

  it("renders the build timestamp", () => {
    renderNode(makeNode())
    // en-GB date string will include the year
    expect(screen.getByText(/2024/)).toBeInTheDocument()
  })

  // Epic 4.3 — environment badge colours
  it.each([
    ["dev", "#6b7280"],
    ["qa", "#3b82f6"],
    ["preprod", "#8b5cf6"],
    ["prod", "#22c55e"],
  ] as const)("applies correct border colour for %s environment", (env, hex) => {
    const node = makeNode({ environment: env })
    node.highestEnv = env
    const { container } = renderNode(node)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.border).toContain(hex)
  })

  // Epic 4.4 — warning indicators
  it("shows DB warning when hasDbChanges is true", () => {
    renderNode(makeNode({ hasDbChanges: true }))
    expect(screen.getByText(/DB changes/i)).toBeInTheDocument()
  })

  it("shows env-var warning when hasEnvChanges is true", () => {
    renderNode(makeNode({ hasEnvChanges: true }))
    expect(screen.getByText(/Env vars changed/i)).toBeInTheDocument()
  })

  it("shows both warnings when both flags are true", () => {
    renderNode(makeNode({ hasDbChanges: true, hasEnvChanges: true }))
    expect(screen.getByText(/DB changes/i)).toBeInTheDocument()
    expect(screen.getByText(/Env vars changed/i)).toBeInTheDocument()
  })

  it("shows no warnings when no risk flags are set", () => {
    renderNode(makeNode())
    expect(screen.queryByText(/DB changes/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Env vars changed/i)).not.toBeInTheDocument()
  })

  it("calls onClick with the version node when clicked", async () => {
    const onClick = vi.fn()
    const node = makeNode()
    renderNode(node, onClick)
    await userEvent.click(screen.getByText("1.2.3"))
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick).toHaveBeenCalledWith(node)
  })
})
