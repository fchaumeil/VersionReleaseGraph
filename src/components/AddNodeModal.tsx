import { useState } from "react"
import * as semver from "semver"
import type { VersionNode, Environment, Build } from "../lib/types"

const ENVIRONMENTS: Environment[] = ["dev", "qa", "preprod", "prod"]

interface Props {
  onAdd: (node: VersionNode) => void
  onClose: () => void
}

export function AddNodeModal({ onAdd, onClose }: Props) {
  const [version, setVersion] = useState("")
  const [environment, setEnvironment] = useState<Environment>("dev")
  const [commitSha, setCommitSha] = useState("")
  const [buildUrl, setBuildUrl] = useState("")
  const [hasDbChanges, setHasDbChanges] = useState(false)
  const [hasEnvChanges, setHasEnvChanges] = useState(false)
  const [versionError, setVersionError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = semver.valid(version.trim())
    if (!v) {
      setVersionError("Must be a valid semver string (e.g. 1.2.3)")
      return
    }

    const tags: string[] = [`env:${environment}`]
    if (hasDbChanges) tags.push("risk:db")
    if (hasEnvChanges) tags.push("risk:env")

    const build: Build = {
      id: `manual-${v}-${environment}`,
      version: v,
      environment,
      timestamp: new Date().toISOString(),
      buildUrl: buildUrl.trim(),
      commitSha: commitSha.trim().slice(0, 7),
      tags,
      hasDbChanges,
      hasEnvChanges,
    }

    onAdd({ version: v, highestEnv: environment, build, allBuilds: [build] })
    onClose()
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "2rem",
          width: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <h3 style={{ margin: "0 0 1.5rem", fontSize: "1.1rem" }}>Add missing node</h3>

        <form onSubmit={handleSubmit}>
          {/* Version */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: 4 }}>
              Version <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => { setVersion(e.target.value); setVersionError(null) }}
              placeholder="e.g. 1.2.3"
              autoFocus
              style={{
                display: "block",
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                border: `1px solid ${versionError ? "#dc2626" : "#d1d5db"}`,
                boxSizing: "border-box",
                fontSize: "0.875rem",
              }}
            />
            {versionError && (
              <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#dc2626" }}>{versionError}</p>
            )}
          </div>

          {/* Environment */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: 4 }}>
              Environment <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as Environment)}
              style={{
                display: "block",
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                boxSizing: "border-box",
                fontSize: "0.875rem",
                background: "#fff",
              }}
            >
              {ENVIRONMENTS.map((env) => (
                <option key={env} value={env}>{env}</option>
              ))}
            </select>
          </div>

          {/* Commit SHA */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: 4 }}>
              Commit SHA <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={commitSha}
              onChange={(e) => setCommitSha(e.target.value)}
              placeholder="e.g. a1b2c3d"
              style={{
                display: "block",
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                boxSizing: "border-box",
                fontSize: "0.875rem",
              }}
            />
          </div>

          {/* Build URL */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: 4 }}>
              Build URL <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="url"
              value={buildUrl}
              onChange={(e) => setBuildUrl(e.target.value)}
              placeholder="https://..."
              style={{
                display: "block",
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                boxSizing: "border-box",
                fontSize: "0.875rem",
              }}
            />
          </div>

          {/* Risk flags */}
          <div style={{ marginBottom: "1.5rem", display: "flex", gap: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
              <input
                type="checkbox"
                checked={hasDbChanges}
                onChange={(e) => setHasDbChanges(e.target.checked)}
              />
              DB changes
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
              <input
                type="checkbox"
                checked={hasEnvChanges}
                onChange={(e) => setHasEnvChanges(e.target.checked)}
              />
              Env vars changed
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: 6,
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Add node
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
