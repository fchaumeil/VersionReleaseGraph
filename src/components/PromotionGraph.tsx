import { useState, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { VersionNodeComponent } from "./VersionNode"
import { BuildDetailsPanel } from "./BuildDetailsPanel"
import type { VersionNode } from "../lib/types"

const NODE_TYPES = { versionNode: VersionNodeComponent }
const NODE_WIDTH = 240
const NODE_HEIGHT = 120
const X_CENTER = 300

// ---------------------------------------------------------------------------
// Closest-handle logic
// ---------------------------------------------------------------------------

type HandleId = "top" | "bottom" | "left" | "right"
const HANDLE_IDS: HandleId[] = ["top", "bottom", "left", "right"]

function handlePosition(node: Node, side: HandleId): { x: number; y: number } {
  const w = (node.measured?.width ?? NODE_WIDTH) as number
  const h = (node.measured?.height ?? NODE_HEIGHT) as number
  const { x, y } = node.position
  switch (side) {
    case "top":    return { x: x + w / 2, y }
    case "bottom": return { x: x + w / 2, y: y + h }
    case "left":   return { x,             y: y + h / 2 }
    case "right":  return { x: x + w,      y: y + h / 2 }
  }
}

function closestPair(
  source: Node,
  target: Node
): { sourceHandle: HandleId; targetHandle: HandleId } {
  let best = Infinity
  let bestSrc: HandleId = "bottom"
  let bestTgt: HandleId = "top"

  for (const sh of HANDLE_IDS) {
    const sp = handlePosition(source, sh)
    for (const th of HANDLE_IDS) {
      const tp = handlePosition(target, th)
      const d = Math.hypot(sp.x - tp.x, sp.y - tp.y)
      if (d < best) { best = d; bestSrc = sh; bestTgt = th }
    }
  }

  return { sourceHandle: bestSrc, targetHandle: bestTgt }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  nodes: VersionNode[]
}

export function PromotionGraph({ nodes: versionNodes }: Props) {
  const [selected, setSelected] = useState<VersionNode | null>(null)

  const initialNodes: Node[] = useMemo(
    () =>
      versionNodes.map((vn, i) => ({
        id: vn.version,
        type: "versionNode",
        position: { x: X_CENTER - NODE_WIDTH / 2, y: i * (NODE_HEIGHT + 40) },
        data: { versionNode: vn, onClick: setSelected, activeHandles: new Set<string>() },
        style: { width: NODE_WIDTH, height: NODE_HEIGHT },
      })),
    [versionNodes]
  )

  const [nodes, , onNodesChange] = useNodesState(initialNodes)

  // Step 1: compute edges + which handles they use
  const edges: Edge[] = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    return versionNodes.slice(0, -1).map((vn, i) => {
      const src = byId.get(vn.version)
      const tgt = byId.get(versionNodes[i + 1].version)
      const { sourceHandle, targetHandle } =
        src && tgt
          ? closestPair(src, tgt)
          : { sourceHandle: "bottom" as HandleId, targetHandle: "top" as HandleId }
      return {
        id: `e-${i}`,
        source: vn.version,
        target: versionNodes[i + 1].version,
        sourceHandle,
        targetHandle,
        type: "default",
      }
    })
  }, [nodes, versionNodes])

  // Step 2: map each node → which of its handles are in use
  const activeHandlesMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const edge of edges) {
      if (edge.sourceHandle) {
        if (!map.has(edge.source)) map.set(edge.source, new Set())
        map.get(edge.source)!.add(edge.sourceHandle)
      }
      if (edge.targetHandle) {
        if (!map.has(edge.target)) map.set(edge.target, new Set())
        map.get(edge.target)!.add(edge.targetHandle)
      }
    }
    return map
  }, [edges])

  // Step 3: enrich nodes with active handle info for rendering
  const enrichedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          activeHandles: activeHandlesMap.get(n.id) ?? new Set<string>(),
        },
      })),
    [nodes, activeHandlesMap]
  )

  if (versionNodes.length === 0) {
    return <p style={{ padding: "2rem", color: "#888" }}>No builds found for this client.</p>
  }

  return (
    <>
      <div style={{ width: "100%", height: "100vh" }}>
        <ReactFlow
          nodes={enrichedNodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          snapToGrid
          snapGrid={[20, 20]}
          selectionOnDrag
          panOnDrag={[1, 2]}
          panOnScroll
          multiSelectionKeyCode={["Control", "Meta"]}
          onSelectionChange={({ nodes: sel }) => { if (sel.length > 1) setSelected(null) }}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      <BuildDetailsPanel node={selected} onClose={() => setSelected(null)} />
    </>
  )
}
