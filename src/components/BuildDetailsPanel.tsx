import type { VersionNode } from "../lib/types"

interface Props {
  node: VersionNode | null
  onClose: () => void
}

export function BuildDetailsPanel({ node, onClose }: Props) {
  if (!node) return null
  const { version, highestEnv, build, allBuilds } = node

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
      <button onClick={onClose} style={{ float: "right", cursor: "pointer" }}>
        ✕
      </button>
      <h2 style={{ margin: 0 }}>{version}</h2>
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
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              background: "#f3f4f6",
              fontSize: "0.8rem",
            }}
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
    </div>
  )
}
