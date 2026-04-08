import { useState, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
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

interface Props {
  nodes: VersionNode[]
}

export function PromotionGraph({ nodes: versionNodes }: Props) {
  const [selected, setSelected] = useState<VersionNode | null>(null)

  const { flowNodes, flowEdges } = useMemo(() => {
    const flowNodes: Node[] = versionNodes.map((vn, i) => ({
      id: vn.version,
      type: "versionNode",
      position: { x: X_CENTER - NODE_WIDTH / 2, y: i * (NODE_HEIGHT + 40) },
      data: { versionNode: vn, onClick: setSelected },
    }))

    const flowEdges: Edge[] = versionNodes.slice(0, -1).map((vn, i) => ({
      id: `e-${i}`,
      source: vn.version,
      target: versionNodes[i + 1].version,
      type: "straight",
    }))

    return { flowNodes, flowEdges }
  }, [versionNodes])

  if (versionNodes.length === 0) {
    return <p style={{ padding: "2rem", color: "#888" }}>No builds found for this client.</p>
  }

  return (
    <>
      <div style={{ width: "100%", height: "100vh" }}>
        <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={NODE_TYPES} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      <BuildDetailsPanel node={selected} onClose={() => setSelected(null)} />
    </>
  )
}
