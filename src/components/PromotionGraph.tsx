import { useState, useMemo, useEffect } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import * as semver from "semver"
import { VersionNodeComponent } from "./VersionNode"
import { BuildDetailsPanel } from "./BuildDetailsPanel"
import { AddNodeModal } from "./AddNodeModal"
import { useManualNodes } from "../hooks/useManualNodes"
import { useAdoStatus, type AdoStatus } from "../hooks/useAdoStatus"
import type { VersionNode } from "../lib/types"
import { ENV_PRIORITY } from "../lib/types"

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
// Merge helper: combine real + manual nodes, keep highest env per version
// ---------------------------------------------------------------------------

function mergeNodes(real: VersionNode[], manual: VersionNode[]): VersionNode[] {
  const byVersion = new Map<string, { node: VersionNode; isManual: boolean }>()

  for (const vn of real) {
    byVersion.set(vn.version, { node: vn, isManual: false })
  }

  for (const vn of manual) {
    const existing = byVersion.get(vn.version)
    if (!existing) {
      byVersion.set(vn.version, { node: vn, isManual: true })
    } else {
      const merged: VersionNode =
        ENV_PRIORITY[vn.highestEnv] > ENV_PRIORITY[existing.node.highestEnv]
          ? { ...vn, allBuilds: [...existing.node.allBuilds, ...vn.allBuilds] }
          : { ...existing.node, allBuilds: [...existing.node.allBuilds, ...vn.allBuilds] }
      byVersion.set(vn.version, { node: merged, isManual: existing.isManual })
    }
  }

  return [...byVersion.values()]
    .sort((a, b) => semver.compare(a.node.version, b.node.version))
    .map(({ node }) => node)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  nodes: VersionNode[]
  /** When provided, manual nodes are persisted to Firestore under this key */
  clientId?: string
}

export function PromotionGraph({ nodes: versionNodes, clientId }: Props) {
  const [selected, setSelected] = useState<VersionNode | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const { manualNodes, addNode: handleAddNode, updateNode } = useManualNodes(clientId ?? "")

  const manualVersions = useMemo(
    () => new Set(manualNodes.map((n) => n.version)),
    [manualNodes]
  )

  const allVersionNodes = useMemo(
    () => mergeNodes(versionNodes, manualNodes),
    [versionNodes, manualNodes]
  )

  const initialNodes: Node[] = useMemo(
    () =>
      allVersionNodes.map((vn, i) => ({
        id: vn.version,
        type: "versionNode",
        position: { x: X_CENTER - NODE_WIDTH / 2, y: i * (NODE_HEIGHT + 40) },
        data: {
          versionNode: vn,
          onClick: setSelected,
          activeHandles: new Set<string>(),
          isManual: manualVersions.has(vn.version),
        },
        style: { width: NODE_WIDTH, height: NODE_HEIGHT },
      })),
    [allVersionNodes, manualVersions]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)

  // Sync ReactFlow node list whenever the source version data changes
  useEffect(() => { setNodes(initialNodes) }, [allVersionNodes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Step 1: compute edges + which handles they use
  const edges: Edge[] = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    return allVersionNodes.slice(0, -1).map((vn, i) => {
      const src = byId.get(vn.version)
      const tgt = byId.get(allVersionNodes[i + 1].version)
      const { sourceHandle, targetHandle } =
        src && tgt
          ? closestPair(src, tgt)
          : { sourceHandle: "bottom" as HandleId, targetHandle: "top" as HandleId }
      return {
        id: `e-${i}`,
        source: vn.version,
        target: allVersionNodes[i + 1].version,
        sourceHandle,
        targetHandle,
        type: "default",
      }
    })
  }, [nodes, allVersionNodes])

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

  if (versionNodes.length === 0 && manualNodes.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
        <GraphToolbar onAddNode={() => setShowAddModal(true)} />
        <p style={{ padding: "2rem", color: "#888" }}>No builds found for this client.</p>
        {showAddModal && (
          <AddNodeModal onAdd={handleAddNode} onClose={() => setShowAddModal(false)} />
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100vh" }}>
        <GraphToolbar onAddNode={() => setShowAddModal(true)} />
        <div style={{ flex: 1 }}>
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
      </div>
      <BuildDetailsPanel
        node={selected}
        isManual={selected ? manualVersions.has(selected.version) : false}
        onSave={async (updated) => { await updateNode(updated.version, updated); setSelected(updated) }}
        onClose={() => setSelected(null)}
      />
      {showAddModal && (
        <AddNodeModal onAdd={handleAddNode} onClose={() => setShowAddModal(false)} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function GraphToolbar({ onAddNode }: { onAddNode: () => void }) {
  const adoStatus = useAdoStatus()

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.5rem 1rem",
        borderBottom: "1px solid #e5e7eb",
        background: "#f9fafb",
        flexShrink: 0,
      }}
    >
      <button
        onClick={onAddNode}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.4rem 0.875rem",
          borderRadius: 6,
          border: "1px solid #d1d5db",
          background: "#fff",
          cursor: "pointer",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "#374151",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6" }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "#fff" }}
      >
        <span style={{ fontSize: "1rem", lineHeight: 1 }}>+</span>
        Add node
      </button>

      <div style={{ marginLeft: "auto" }}>
        <AdoStatusIndicator status={adoStatus} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ADO connection status indicator
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<AdoStatus, { color: string; label: string }> = {
  mock:      { color: "#f59e0b", label: "Mock data"       },
  checking:  { color: "#9ca3af", label: "Checking…"       },
  connected: { color: "#22c55e", label: "ADO connected"   },
  error:     { color: "#ef4444", label: "ADO unreachable" },
}

function AdoStatusIndicator({ status }: { status: AdoStatus }) {
  const { color, label } = STATUS_CONFIG[status]
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: "0.8rem",
        color: "#6b7280",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
          boxShadow: status === "connected" ? `0 0 0 2px ${color}33` : "none",
        }}
      />
      {label}
    </div>
  )
}
