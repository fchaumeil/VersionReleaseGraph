import { useNavigate } from "react-router-dom"
import type { Client } from "../lib/types"

interface Props {
  client: Client
}

export function ClientTile({ client }: Props) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/client/${client.id}`)}
      style={{
        padding: "1.5rem 2rem",
        borderRadius: 8,
        border: "1px solid #d0d0d0",
        background: "#fff",
        cursor: "pointer",
        fontSize: "1.1rem",
        fontWeight: 600,
        textAlign: "left",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      {client.name}
    </button>
  )
}
