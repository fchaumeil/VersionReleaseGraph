import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { PromotionGraph } from "./PromotionGraph"
import type { VersionNode } from "../lib/types"
import type { Node, Edge } from "@xyflow/react"

// Epic 4.1 — React Flow container, vertical layout
// Epic 4.5 — Straight edges connecting nodes top-to-bottom
// Epic 4.6 — Scroll support (delegated to React Flow)
// Epic 4.7 — Empty state

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
})
