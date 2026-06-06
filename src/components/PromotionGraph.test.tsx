import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PromotionGraph } from "./PromotionGraph"
import type { VersionNode } from "../lib/types"
import type { Node, Edge } from "@xyflow/react"

// Epic 4.1 — React Flow container, vertical layout
// Epic 4.5 — Straight edges connecting nodes top-to-bottom
// Epic 4.6 — Scroll support (delegated to React Flow)
// Epic 4.7 — Empty state

// ---------------------------------------------------------------------------
// Mock useManualNodes so tests don't touch Firebase
// ---------------------------------------------------------------------------

vi.mock("../hooks/useManualNodes", () => ({
  useManualNodes: () => {
    const [manualNodes, setManualNodes] = React.useState<VersionNode[]>([])
    return {
      manualNodes,
      addNode: (node: VersionNode) => {
        setManualNodes((prev) => [...prev, node])
        return Promise.resolve()
      },
      syncing: false,
    }
  },
}))

// ---------------------------------------------------------------------------
// Capture props passed to ReactFlow so we can assert on nodes/edges
// ---------------------------------------------------------------------------

const capturedProps = vi.hoisted(() => ({ nodes: [] as Node[], edges: [] as Edge[] }))

vi.mock("@xyflow/react", () => {
  const Position = { Top: "top", Bottom: "bottom", Left: "left", Right: "right" }

  function useNodesState(init: Node[]) {
    const [nodes, setNodes] = React.useState(init)
    return [nodes, setNodes, vi.fn()] as const
  }

  return {
    ReactFlow: (props: { nodes: Node[]; edges: Edge[] }) => {
      capturedProps.nodes = props.nodes
      capturedProps.edges = props.edges
      return <div data-testid="react-flow" />
    },
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    NodeResizer: () => null,
    Position,
    useNodesState,
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVersionNode(version: string, env: "dev" | "qa" | "preprod" | "prod"): VersionNode {
  const build = {
    id: version,
    version,
    environment: env,
    timestamp: "2024-01-01T00:00:00Z",
    buildUrl: `https://dev.azure.com/mock/_build/results?buildId=${version}`,
    commitSha: "abc1234",
    tags: [`env:${env}`],
    hasDbChanges: false,
    hasEnvChanges: false,
  }
  return { version, highestEnv: env, build, allBuilds: [build] }
}

const THREE_NODES = [
  makeVersionNode("1.0.0", "prod"),
  makeVersionNode("1.1.0", "qa"),
  makeVersionNode("1.2.0", "dev"),
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PromotionGraph", () => {
  beforeEach(() => {
    capturedProps.nodes = []
    capturedProps.edges = []
  })

  // Epic 4.7
  it("shows empty state message when there are no nodes", () => {
    render(<PromotionGraph nodes={[]} />)
    expect(screen.getByText(/no builds found/i)).toBeInTheDocument()
    expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument()
  })

  // Epic 4.1
  it("renders ReactFlow when nodes are provided", () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    expect(screen.getByTestId("react-flow")).toBeInTheDocument()
  })

  it("passes one React Flow node per version node", () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    expect(capturedProps.nodes).toHaveLength(3)
  })

  it("uses the version string as the React Flow node id", () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    const ids = capturedProps.nodes.map((n) => n.id)
    expect(ids).toEqual(["1.0.0", "1.1.0", "1.2.0"])
  })

  it("positions nodes vertically (increasing y, same x)", () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    const ys = capturedProps.nodes.map((n) => n.position.y)
    expect(ys[0]).toBeLessThan(ys[1])
    expect(ys[1]).toBeLessThan(ys[2])
    const xs = capturedProps.nodes.map((n) => n.position.x)
    expect(xs[0]).toBe(xs[1])
    expect(xs[1]).toBe(xs[2])
  })

  // Epic 4.5
  it("creates n-1 edges for n nodes (one per consecutive pair)", () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    expect(capturedProps.edges).toHaveLength(2)
  })

  it("each edge connects consecutive nodes source→target", () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    expect(capturedProps.edges[0].source).toBe("1.0.0")
    expect(capturedProps.edges[0].target).toBe("1.1.0")
    expect(capturedProps.edges[1].source).toBe("1.1.0")
    expect(capturedProps.edges[1].target).toBe("1.2.0")
  })

  it("uses bezier (default) edge type", () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    for (const edge of capturedProps.edges) {
      expect(edge.type).toBe("default")
    }
  })

  it("creates no edges when there is only one node", () => {
    render(<PromotionGraph nodes={[makeVersionNode("1.0.0", "prod")]} />)
    expect(capturedProps.edges).toHaveLength(0)
  })

  // Epic 5.1 — side panel opens on node click
  it("shows BuildDetailsPanel after a node's onClick is invoked", () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    const clickCallback = capturedProps.nodes[0].data.onClick as (n: VersionNode) => void
    act(() => clickCallback(THREE_NODES[0]))
    expect(screen.getByText("1.0.0")).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Toolbar
  // ---------------------------------------------------------------------------

  it("renders an 'Add node' toolbar button when nodes are provided", () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    expect(screen.getByRole("button", { name: /add node/i })).toBeInTheDocument()
  })

  it("renders an 'Add node' toolbar button in the empty state", () => {
    render(<PromotionGraph nodes={[]} />)
    expect(screen.getByRole("button", { name: /add node/i })).toBeInTheDocument()
  })

  it("opens the AddNodeModal when the toolbar button is clicked", async () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("closes the AddNodeModal when Cancel is clicked", async () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Manual node addition
  // ---------------------------------------------------------------------------

  it("adds a new node to the graph after a valid modal submission", async () => {
    render(<PromotionGraph nodes={THREE_NODES} />)
    expect(capturedProps.nodes).toHaveLength(3)

    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "2.0.0")
    await userEvent.click(screen.getByRole("button", { name: "Add node" }))

    expect(capturedProps.nodes).toHaveLength(4)
    expect(capturedProps.nodes.some((n) => n.id === "2.0.0")).toBe(true)
  })

  it("inserts the new node in semver order", async () => {
    render(<PromotionGraph nodes={THREE_NODES} />)

    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "1.1.5")
    await userEvent.click(screen.getByRole("button", { name: "Add node" }))

    const ids = capturedProps.nodes.map((n) => n.id)
    expect(ids).toEqual(["1.0.0", "1.1.0", "1.1.5", "1.2.0"])
  })

  it("marks a newly added node with isManual=true", async () => {
    render(<PromotionGraph nodes={THREE_NODES} />)

    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "2.0.0")
    await userEvent.click(screen.getByRole("button", { name: "Add node" }))

    const added = capturedProps.nodes.find((n) => n.id === "2.0.0")
    expect(added?.data.isManual).toBe(true)
  })

  it("does not mark original nodes as manual", async () => {
    render(<PromotionGraph nodes={THREE_NODES} />)

    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "2.0.0")
    await userEvent.click(screen.getByRole("button", { name: "Add node" }))

    const original = capturedProps.nodes.find((n) => n.id === "1.0.0")
    expect(original?.data.isManual).toBeFalsy()
  })

  it("merges manual node into existing version when its env is higher", async () => {
    // 1.2.0 is currently dev; adding it as prod should upgrade it
    render(<PromotionGraph nodes={THREE_NODES} />)

    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "1.2.0")
    await userEvent.selectOptions(screen.getByRole("combobox"), "prod")
    await userEvent.click(screen.getByRole("button", { name: "Add node" }))

    // Still 3 nodes (no duplicate)
    expect(capturedProps.nodes).toHaveLength(3)
    const merged = capturedProps.nodes.find((n) => n.id === "1.2.0")
    expect((merged?.data.versionNode as VersionNode).highestEnv).toBe("prod")
  })

  it("keeps existing node when manual env is lower", async () => {
    // 1.0.0 is prod; adding it as dev should keep it as prod
    render(<PromotionGraph nodes={THREE_NODES} />)

    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "1.0.0")
    // default env is dev
    await userEvent.click(screen.getByRole("button", { name: "Add node" }))

    expect(capturedProps.nodes).toHaveLength(3)
    const node = capturedProps.nodes.find((n) => n.id === "1.0.0")
    expect((node?.data.versionNode as VersionNode).highestEnv).toBe("prod")
  })

  it("shows ReactFlow after adding a node from the empty state", async () => {
    render(<PromotionGraph nodes={[]} />)
    expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "1.0.0")
    await userEvent.click(screen.getByRole("button", { name: "Add node" }))

    expect(screen.getByTestId("react-flow")).toBeInTheDocument()
  })
})
