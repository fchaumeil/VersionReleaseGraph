import { useState, useEffect } from "react"
import type { VersionNode, Environment, Build } from "../lib/types"

const ENVIRONMENTS: Environment[] = ["dev", "qa", "preprod", "prod"]

const ENV_COLORS: Record<Environment, string> = {
  dev: "#6b7280",
  qa: "#3b82f6",
  preprod: "#8b5cf6",
  prod: "#22c55e",
}

interface Props {
  node: VersionNode | null
  isManual?: boolean
  onSave?: (updated: VersionNode) => Promise<void>
  onClose: () => void
}

interface Draft {
  environment: Environment
  commitSha: string
  buildUrl: string
  hasDbChanges: boolean
  hasEnvChanges: boolean
}

function draftFromNode(node: VersionNode): Draft {
  return {
    environment: node.build.environment,
    commitSha: node.build.commitSha,
    buildUrl: node.build.buildUrl,
    hasDbChanges: node.build.hasDbChanges,
    hasEnvChanges: node.build.hasEnvChanges,
  }
}

function buildUpdatedNode(original: VersionNode, draft: Draft): VersionNode {
  const tags: string[] = [`env:${draft.environment}`]
  if (draft.hasDbChanges) tags.push("risk:db")
  if (draft.hasEnvChanges) tags.push("risk:env")

  const updatedBuild: Build = {
    ...original.build,
    environment: draft.environment,
    commitSha: draft.commitSha.trim().slice(0, 7),
    buildUrl: draft.buildUrl.trim(),
    tags,
    hasDbChanges: draft.hasDbChanges,
    hasEnvChanges: draft.hasEnvChanges,
  }

  return {
    version: original.version,
    highestEnv: draft.environment,
    build: updatedBuild,
    allBuilds: [updatedBuild],
  }
}

// ---------------------------------------------------------------------------
// Panel shell
// ---------------------------------------------------------------------------

export function BuildDetailsPanel({ node, isManual = false, onSave, onClose }: Props) {
  if (!node) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: 380,
        background: "#fff",
        borderLeft: "1px solid #d0d0d0",
        boxShadow: "-4px 0 12px rgba(0,0,0,0.1)",
        overflowY: "auto",
        zIndex: 100,
        padding: "1.5rem",
      }}
    >
      <button onClick={onClose} style={{ float: "right", cursor: "pointer" }}>✕</button>
      <h2 style={{ margin: 0 }}>{node.version}</h2>

      {isManual
        ? <EditableFields node={node} onSave={onSave!} />
        : <ReadOnlyFields node={node} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Read-only view (Azure DevOps nodes)
// ---------------------------------------------------------------------------

function ReadOnlyFields({ node }: { node: VersionNode }) {
  const { highestEnv, build, allBuilds } = node
  return (
    <>
      <p style={{ margin: "0.5rem 0" }}>
        <strong>Highest env:</strong> {highestEnv}
      </p>
      <p style={{ margin: "0.5rem 0" }}>
        <strong>Timestamp:</strong>{" "}
        {new Date(build.timestamp).toLocaleString()}
      </p>
      <p style={{ margin: "0.5rem 0" }}>
        <strong>Commit:</strong>{" "}
        <code
          style={{ cursor: "pointer" }}
          onClick={() => navigator.clipboard.writeText(build.commitSha)}
          title="Click to copy"
        >
          {build.commitSha}
        </code>
      </p>
      <a href={build.buildUrl} target="_blank" rel="noreferrer">
        Open in Azure DevOps
      </a>

      {build.hasDbChanges && (
        <p style={{ color: "#f97316", marginTop: "1rem" }}>&#x1F4BE; DB changes in this build</p>
      )}
      {build.hasEnvChanges && (
        <p style={{ color: "#f97316" }}>&#x2699;&#xFE0F; Environment variables changed</p>
      )}

      <h3 style={{ marginTop: "1.5rem" }}>Tags</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {build.tags.map((tag) => (
          <span
            key={tag}
            style={{ padding: "2px 8px", borderRadius: 4, background: "#f3f4f6", fontSize: "0.8rem" }}
          >
            {tag}
          </span>
        ))}
      </div>

      <h3 style={{ marginTop: "1.5rem" }}>Environments reached</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", paddingBottom: 4 }}>Env</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", paddingBottom: 4 }}>Timestamp</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {allBuilds.map((b) => (
            <tr key={b.id}>
              <td style={{ padding: "4px 0" }}>{b.environment}</td>
              <td style={{ padding: "4px 0" }}>{new Date(b.timestamp).toLocaleString()}</td>
              <td style={{ padding: "4px 0" }}>
                <a href={b.buildUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem" }}>
                  link
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// ---------------------------------------------------------------------------
// Editable form (manual nodes)
// ---------------------------------------------------------------------------

function EditableFields({ node, onSave }: { node: VersionNode; onSave: (updated: VersionNode) => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(() => draftFromNode(node))
  const [saving, setSaving] = useState(false)

  // Reset form when a different manual node is opened
  useEffect(() => { setDraft(draftFromNode(node)) }, [node.version]) // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(buildUpdatedNode(node, draft))
    } finally {
      setSaving(false)
    }
  }

  const color = ENV_COLORS[draft.environment]

  return (
    <>
      {/* Environment */}
      <div style={{ marginTop: "1rem" }}>
        <label style={labelStyle}>Environment</label>
        <select
          value={draft.environment}
          onChange={(e) => set("environment", e.target.value as Environment)}
          style={{ ...inputStyle, background: "#fff" }}
        >
          {ENVIRONMENTS.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </select>
        <span style={{
          display: "inline-block",
          marginTop: 6,
          padding: "2px 8px",
          borderRadius: 4,
          background: color,
          color: "#fff",
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "uppercase",
        }}>
          {draft.environment}
        </span>
      </div>

      {/* Commit SHA */}
      <div style={{ marginTop: "1rem" }}>
        <label style={labelStyle}>Commit SHA</label>
        <input
          type="text"
          value={draft.commitSha}
          onChange={(e) => set("commitSha", e.target.value)}
          placeholder="e.g. a1b2c3d"
          maxLength={40}
          style={inputStyle}
        />
      </div>

      {/* Build URL */}
      <div style={{ marginTop: "1rem" }}>
        <label style={labelStyle}>Build URL</label>
        <input
          type="url"
          value={draft.buildUrl}
          onChange={(e) => set("buildUrl", e.target.value)}
          placeholder="https://..."
          style={inputStyle}
        />
        {draft.buildUrl && (
          <a
            href={draft.buildUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: "block", marginTop: 4, fontSize: "0.8rem" }}
          >
            Open link ↗
          </a>
        )}
      </div>

      {/* Risk flags */}
      <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={draft.hasDbChanges}
            onChange={(e) => set("hasDbChanges", e.target.checked)}
          />
          <span style={{ color: draft.hasDbChanges ? "#f97316" : "#374151" }}>
            &#x1F4BE; DB changes
          </span>
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={draft.hasEnvChanges}
            onChange={(e) => set("hasEnvChanges", e.target.checked)}
          />
          <span style={{ color: draft.hasEnvChanges ? "#f97316" : "#374151" }}>
            &#x2699;&#xFE0F; Env vars changed
          </span>
        </label>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: "1.5rem",
          width: "100%",
          padding: "0.6rem",
          borderRadius: 6,
          border: "none",
          background: saving ? "#9ca3af" : "#3b82f6",
          color: "#fff",
          fontWeight: 600,
          fontSize: "0.875rem",
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </>
  )
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#6b7280",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "0.45rem 0.6rem",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  boxSizing: "border-box",
  fontSize: "0.875rem",
}

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  cursor: "pointer",
  fontSize: "0.875rem",
}
