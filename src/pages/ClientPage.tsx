import { useParams, useNavigate } from "react-router-dom"
import { useBuilds } from "../hooks/useBuilds"
import { PromotionGraph } from "../components/PromotionGraph"

export function ClientPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { nodes, loading, error } = useBuilds(id ?? "")

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e5e7eb", display: "flex", gap: "1rem", alignItems: "center" }}>
        <button onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          &larr; Back
        </button>
        <h2 style={{ margin: 0 }}>Client: {id}</h2>
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        {loading && (
          <p style={{ padding: "2rem", color: "#888" }}>Loading builds...</p>
        )}
        {error && (
          <p style={{ padding: "2rem", color: "#dc2626" }}>Error: {error}</p>
        )}
        {!loading && !error && <PromotionGraph nodes={nodes} />}
      </div>
    </div>
  )
}
