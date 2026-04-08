import { clients } from "../config/clients"
import { ClientTile } from "../components/ClientTile"

export function HomePage() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Version Release Graph</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        {clients.map((client) => (
          <ClientTile key={client.id} client={client} />
        ))}
      </div>
    </div>
  )
}
