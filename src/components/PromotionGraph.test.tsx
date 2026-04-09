import { describe, it, expect, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"
import type { VersionNode } from "../lib/types"

// ---------------------------------------------------------------------------
// Capture ReactFlow props from the mock so we can assert on them
// ---------------------------------------------------------------------------
let capturedProps: Record<string, unknown> = {}
let capturedNodes: unknown[] = []
let capturedEdges: unknown[] = []

vi.mock("@xyflow/react", () => {
  function ReactFlow(props: Record<string, unknown>) {
    capturedProps = props
    capturedNodes = (props.nodes as unknown[]) ?? []
    capturedEdges = (props.edges as unknown[]) ?? []
    return (
      <div data-testid="react-flow">
        {(props.children as React.ReactNode) ?? null}
      </div>
    )
  }
  function Background() { return <div data-testid="background" /> }
  function Controls() { return <div data-testid="controls" /> }
  function useNodesState(init: unknown[]) {
    const [nodes, setNodes] = React.useState(init)
    const onNodesChange = vi.fn((changes: unknown[]) => {
      // minimal position-change simulation
      setNodes((prev) => {
        const next = [...prev] as Record<string, unknown>[]
        changes.forEach((c: Record<string, unknown>) => {
          if (c.type === "position" && c.id && c.position) {
            const idx = next.findIndex((n) => n.id === c.id)
            if (idx !== -1) next[idx] = { ...next[idx], position: c.position }
          }
        })
        return next
      })
    })
    return [nodes, setNodes, onNodesChange] as const
  }
  return { ReactFlow, Background, Controls, useNodesState }
})

// Stub BuildDetailsPanel so we don't need its full dep tree
vi.mock("./BuildDetailsPanel", () => ({
  BuildDetailsPanel: ({ node }: { node: unknown }) =>
    node ? <div data-testid="build-details-panel" /> : null,
}))

// Stub VersionNodeComponent
vi.mock("./VersionNode", () => ({
  VersionNodeComponent: ({ data }: { data: { versionNode: { version: string } } }) => (
    <div data-testid={`version-node-${data.versionNode.version}`} />
  ),
}))

import React from "react"
import { PromotionGraph } from "./PromotionGraph"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVersionNode(version: string, env: "dev" | "qa" | "preprod" | "prod" = "dev"): VersionNode {
  const build = {
    id: version,
    version,
    environment: env,
    timestamp: "2024-01-01T00:00:00Z",
    buildUrl: `https://dev.azure.com/org/proj/_build/results?buildId=${version}`,
    commitSha: "abc1234",
    tags: [`env:${env}`],
    hasDbChanges: false,
    hasEnvChanges: false,
  }
  return { version, highestEnv: env, build, allBuilds: [build] }
}

function renderGraph(nodes: VersionNode[]) {
  capturedProps = {}
  capturedNodes = []
  capturedEdges = []
  return render(<PromotionGraph nodes={nodes} />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PromotionGraph", () => {
  describe("empty state", () => {
    it("shows empty-state message when no nodes are provided", () => {
      renderGraph([])
      expect(screen.getByText(/No builds found for this client/i)).toBeInTheDocument()
    })

    it("does not render ReactFlow when no nodes are provided", () => {
      renderGraph([])
      expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument()
    })
  })

  describe("ReactFlow integration", () => {
    it("renders ReactFlow when version nodes exist", () => {
      renderGraph([makeVersionNode("1.0.0")])
      expect(screen.getByTestId("react-flow")).toBeInTheDocument()
    })

    it("renders Background and Controls inside ReactFlow", () => {
      renderGraph([makeVersionNode("1.0.0")])
      expect(screen.getByTestId("background")).toBeInTheDocument()
      expect(screen.getByTestId("controls")).toBeInTheDocument()
    })

    it("passes one flow node per version node", () => {
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0")])
      expect(capturedNodes).toHaveLength(2)
    })

    it("each flow node has the version as its id", () => {
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0")])
      const ids = (capturedNodes as Array<{ id: string }>).map((n) => n.id)
      expect(ids).toEqual(["1.0.0", "1.1.0"])
    })

    it("each flow node has type 'versionNode'", () => {
      renderGraph([makeVersionNode("1.0.0")])
      const node = (capturedNodes as Array<{ type: string }>)[0]
      expect(node.type).toBe("versionNode")
    })
  })

  describe("draggable nodes", () => {
    it("passes onNodesChange to ReactFlow (nodes are draggable)", () => {
      renderGraph([makeVersionNode("1.0.0")])
      expect(capturedProps.onNodesChange).toBeTypeOf("function")
    })

    it("nodes have initial positions aligned to snap grid (multiples of 20)", () => {
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0")])
      const positions = (capturedNodes as Array<{ position: { x: number; y: number } }>).map(
        (n) => n.position
      )
      positions.forEach(({ x, y }) => {
        expect(x % 20).toBe(0)
        expect(y % 20).toBe(0)
      })
    })
  })

  describe("snap-to-grid", () => {
    it("passes snapToGrid=true to ReactFlow", () => {
      renderGraph([makeVersionNode("1.0.0")])
      expect(capturedProps.snapToGrid).toBe(true)
    })

    it("passes snapGrid=[20,20] to ReactFlow", () => {
      renderGraph([makeVersionNode("1.0.0")])
      expect(capturedProps.snapGrid).toEqual([20, 20])
    })
  })

  describe("bezier spline edges", () => {
    it("creates edges connecting sequential nodes", () => {
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0"), makeVersionNode("1.2.0")])
      expect(capturedEdges).toHaveLength(2)
    })

    it("each edge has type 'default' (bezier)", () => {
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0")])
      const edge = (capturedEdges as Array<{ type: string }>)[0]
      expect(edge.type).toBe("default")
    })

    it("edge source and target ids match version strings", () => {
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0")])
      const edge = (capturedEdges as Array<{ source: string; target: string }>)[0]
      expect(edge.source).toBe("1.0.0")
      expect(edge.target).toBe("1.1.0")
    })

    it("no edges when only one node", () => {
      renderGraph([makeVersionNode("1.0.0")])
      expect(capturedEdges).toHaveLength(0)
    })
  })

  describe("auto-select closest anchor handle", () => {
    it("edges have sourceHandle and targetHandle set", () => {
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0")])
      const edge = (capturedEdges as Array<{ sourceHandle: string; targetHandle: string }>)[0]
      expect(edge.sourceHandle).toBeTruthy()
      expect(edge.targetHandle).toBeTruthy()
    })

    it("default layout: sourceHandle is 'bottom' and targetHandle is 'top' (vertical stack)", () => {
      // In the default vertical layout nodes are stacked top-to-bottom,
      // so bottom→top is the closest pair
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0")])
      const edge = (capturedEdges as Array<{ sourceHandle: string; targetHandle: string }>)[0]
      expect(edge.sourceHandle).toBe("bottom")
      expect(edge.targetHandle).toBe("top")
    })
  })

  describe("active anchor handles", () => {
    it("each enriched node carries an activeHandles Set", () => {
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0")])
      const nodes = capturedNodes as Array<{ data: { activeHandles: Set<string> } }>
      nodes.forEach((n) => {
        expect(n.data.activeHandles).toBeInstanceOf(Set)
      })
    })

    it("the 'bottom' handle of the first node is marked active", () => {
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0")])
      const firstNode = (
        capturedNodes as Array<{ id: string; data: { activeHandles: Set<string> } }>
      ).find((n) => n.id === "1.0.0")!
      expect(firstNode.data.activeHandles.has("bottom")).toBe(true)
    })

    it("the 'top' handle of the last node is marked active", () => {
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0")])
      const lastNode = (
        capturedNodes as Array<{ id: string; data: { activeHandles: Set<string> } }>
      ).find((n) => n.id === "1.1.0")!
      expect(lastNode.data.activeHandles.has("top")).toBe(true)
    })

    it("isolated node (no edges) has an empty activeHandles set", () => {
      renderGraph([makeVersionNode("1.0.0")])
      const node = (capturedNodes as Array<{ data: { activeHandles: Set<string> } }>)[0]
      expect(node.data.activeHandles.size).toBe(0)
    })
  })

  describe("multi-select", () => {
    it("passes selectionOnDrag to ReactFlow", () => {
      renderGraph([makeVersionNode("1.0.0")])
      expect(capturedProps.selectionOnDrag).toBe(true)
    })

    it("passes panOnDrag=[1,2] to ReactFlow (middle-button or right-button pan)", () => {
      renderGraph([makeVersionNode("1.0.0")])
      expect(capturedProps.panOnDrag).toEqual([1, 2])
    })

    it("passes multiSelectionKeyCode including Control and Meta", () => {
      renderGraph([makeVersionNode("1.0.0")])
      const keys = capturedProps.multiSelectionKeyCode as string[]
      expect(keys).toContain("Control")
      expect(keys).toContain("Meta")
    })

    it("onSelectionChange is passed to ReactFlow", () => {
      renderGraph([makeVersionNode("1.0.0")])
      expect(capturedProps.onSelectionChange).toBeTypeOf("function")
    })

    it("onSelectionChange closes the details panel when >1 nodes are selected", () => {
      renderGraph([makeVersionNode("1.0.0"), makeVersionNode("1.1.0")])
      // Fire onSelectionChange with 2 selected nodes
      const onSelectionChange = capturedProps.onSelectionChange as (arg: { nodes: unknown[] }) => void
      act(() => {
        onSelectionChange({ nodes: [{ id: "1.0.0" }, { id: "1.1.0" }] })
      })
      // Panel should not be rendered (selected is null)
      expect(screen.queryByTestId("build-details-panel")).not.toBeInTheDocument()
    })
  })
})
