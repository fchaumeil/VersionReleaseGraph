import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BuildDetailsPanel } from "./BuildDetailsPanel"
import type { VersionNode } from "../lib/types"

// Epic 5.1 — side panel triggered by node click
// Epic 5.2 — version, environment, timestamp, commit SHA
// Epic 5.3 — Azure DevOps external link
// Epic 5.4 — all raw tags
// Epic 5.5 — per-environment breakdown table

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<VersionNode> = {}): VersionNode {
  const devBuild = {
    id: "10",
    version: "2.3.4",
    environment: "dev" as const,
    timestamp: "2024-06-01T08:00:00Z",
    buildUrl: "https://dev.azure.com/mock/_build/results?buildId=10",
    commitSha: "abc1234",
    tags: ["env:dev"],
    hasDbChanges: false,
    hasEnvChanges: false,
  }
  const prodBuild = {
    id: "11",
    version: "2.3.4",
    environment: "prod" as const,
    timestamp: "2024-06-03T14:00:00Z",
    buildUrl: "https://dev.azure.com/mock/_build/results?buildId=11",
    commitSha: "abc1234",
    tags: ["env:prod", "risk:db"],
    hasDbChanges: true,
    hasEnvChanges: false,
  }
  return {
    version: "2.3.4",
    highestEnv: "prod",
    build: prodBuild,
    allBuilds: [devBuild, prodBuild],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BuildDetailsPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn() } })
  })

  // Epic 5.1
  it("renders nothing when node is null", () => {
    const { container } = render(<BuildDetailsPanel node={null} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the panel when a node is provided", () => {
    render(<BuildDetailsPanel node={makeNode()} onClose={vi.fn()} />)
    expect(screen.getByRole("heading", { name: "2.3.4" })).toBeInTheDocument()
  })

  // Epic 5.2
  it("shows the version", () => {
    render(<BuildDetailsPanel node={makeNode()} onClose={vi.fn()} />)
    expect(screen.getByRole("heading", { name: "2.3.4" })).toBeInTheDocument()
  })

  it("shows the highest environment", () => {
    render(<BuildDetailsPanel node={makeNode()} onClose={vi.fn()} />)
    // The "Highest env:" paragraph contains the env value
    const para = screen.getByText(/highest env/i).closest("p")
    expect(para).toHaveTextContent("prod")
  })

  it("shows the build timestamp", () => {
    render(<BuildDetailsPanel node={makeNode()} onClose={vi.fn()} />)
    // "Timestamp:" appears both in the <strong> label and the table header — pick the <strong>
    const label = screen.getAllByText(/timestamp/i).find((el) => el.tagName === "STRONG")
    expect(label?.closest("p")).toHaveTextContent("2024")
  })

  it("shows the commit SHA", () => {
    render(<BuildDetailsPanel node={makeNode()} onClose={vi.fn()} />)
    expect(screen.getByText("abc1234")).toBeInTheDocument()
  })

  it("copies commit SHA to clipboard when clicked", async () => {
    render(<BuildDetailsPanel node={makeNode()} onClose={vi.fn()} />)
    await userEvent.click(screen.getByText("abc1234"))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("abc1234")
  })

  // Epic 5.3
  it("shows an Azure DevOps external link", () => {
    render(<BuildDetailsPanel node={makeNode()} onClose={vi.fn()} />)
    const link = screen.getByRole("link", { name: /open in azure devops/i })
    expect(link).toHaveAttribute("href", "https://dev.azure.com/mock/_build/results?buildId=11")
    expect(link).toHaveAttribute("target", "_blank")
  })

  // Epic 5.4
  it("displays all raw tags from the build", () => {
    render(<BuildDetailsPanel node={makeNode()} onClose={vi.fn()} />)
    expect(screen.getByText("env:prod")).toBeInTheDocument()
    expect(screen.getByText("risk:db")).toBeInTheDocument()
  })

  it("shows DB warning when hasDbChanges is true", () => {
    render(<BuildDetailsPanel node={makeNode()} onClose={vi.fn()} />)
    expect(screen.getByText(/DB changes in this build/i)).toBeInTheDocument()
  })

  it("does not show DB warning when hasDbChanges is false", () => {
    const node = makeNode()
    node.build = { ...node.build, hasDbChanges: false }
    render(<BuildDetailsPanel node={node} onClose={vi.fn()} />)
    expect(screen.queryByText(/DB changes in this build/i)).not.toBeInTheDocument()
  })

  it("shows env-var warning when hasEnvChanges is true", () => {
    const node = makeNode()
    node.build = { ...node.build, hasEnvChanges: true }
    render(<BuildDetailsPanel node={node} onClose={vi.fn()} />)
    expect(screen.getByText(/environment variables changed/i)).toBeInTheDocument()
  })

  // Epic 5.5
  it("renders a table row for each environment reached", () => {
    render(<BuildDetailsPanel node={makeNode()} onClose={vi.fn()} />)
    // 1 header row + 2 data rows (dev + prod)
    expect(screen.getAllByRole("row")).toHaveLength(3)
    const cells = screen.getAllByRole("cell")
    const envCells = cells.filter((c) => ["dev", "prod"].includes(c.textContent ?? ""))
    expect(envCells).toHaveLength(2)
  })

  it("each environment row has a link to its build", () => {
    render(<BuildDetailsPanel node={makeNode()} onClose={vi.fn()} />)
    const links = screen.getAllByRole("link", { name: "link" })
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute("href", "https://dev.azure.com/mock/_build/results?buildId=10")
    expect(links[1]).toHaveAttribute("href", "https://dev.azure.com/mock/_build/results?buildId=11")
  })

  // Epic 5.1 — close
  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn()
    render(<BuildDetailsPanel node={makeNode()} onClose={onClose} />)
    await userEvent.click(screen.getByText("✕"))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
