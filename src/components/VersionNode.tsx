import { useState } from "react"
import { Handle, Position, NodeResizer } from "@xyflow/react"
import type { VersionNode as VersionNodeType } from "../lib/types"

const ENV_COLORS: Record<string, string> = {
  dev: "#6b7280",
  qa: "#3b82f6",
  preprod: "#8b5cf6",
  prod: "#22c55e",
}

interface Props {
  data: {
    versionNode: VersionNodeType
    onClick: (node: VersionNodeType) => void
  }
}

export function VersionNodeComponent({ data }: Props) {
  const { versionNode, onClick } = data
  const { version, highestEnv, build } = versionNode
  const color = ENV_COLORS[highestEnv] ?? "#6b7280"
  const [hovered, setHovered] = useState(false)
  const date = new Date(build.timestamp).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div
      onClick={() => onClick(versionNode)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "0.75rem 1rem",
        borderRadius: 8,
        border: `2px solid ${color}`,
        background: "#fff",
        cursor: "pointer",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        userSelect: "none",
      }}
    >
      <NodeResizer isVisible={hovered} minWidth={220} minHeight={90} lineStyle={{ borderColor: color }} />

      {/* Hidden anchor handles on all 4 sides — PromotionGraph picks the closest pair per edge */}
      <Handle id="top"    type="target" position={Position.Top}    isConnectable={false} style={{ opacity: 0 }} />
      <Handle id="bottom" type="target" position={Position.Bottom} isConnectable={false} style={{ opacity: 0 }} />
      <Handle id="left"   type="target" position={Position.Left}   isConnectable={false} style={{ opacity: 0 }} />
      <Handle id="right"  type="target" position={Position.Right}  isConnectable={false} style={{ opacity: 0 }} />
      <Handle id="top"    type="source" position={Position.Top}    isConnectable={false} style={{ opacity: 0 }} />
      <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={false} style={{ opacity: 0 }} />
      <Handle id="left"   type="source" position={Position.Left}   isConnectable={false} style={{ opacity: 0 }} />
      <Handle id="right"  type="source" position={Position.Right}  isConnectable={false} style={{ opacity: 0 }} />

      <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{version}</div>
      <span
        style={{
          display: "inline-block",
          marginTop: 4,
          padding: "2px 8px",
          borderRadius: 4,
          background: color,
          color: "#fff",
          fontSize: "0.8rem",
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        {highestEnv}
      </span>
      <div style={{ marginTop: 6, fontSize: "0.8rem", color: "#555" }}>{date}</div>
      {(build.hasDbChanges || build.hasEnvChanges) && (
        <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
          {build.hasDbChanges && (
            <span style={{ color: "#f97316", fontSize: "0.75rem" }}>&#x1F4BE; DB changes</span>
          )}
          {build.hasEnvChanges && (
            <span style={{ color: "#f97316", fontSize: "0.75rem" }}>&#x2699;&#xFE0F; Env vars changed</span>
          )}
        </div>
      )}
    </div>
  )
}
