import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { HomePage } from "./HomePage"
import { clients } from "../config/clients"

// Epic 3.2 — Tile grid with navigation

function renderHomePage() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <HomePage /> },
      { path: "/client/:id", element: <div data-testid="client-page" /> },
    ],
    { initialEntries: ["/"] }
  )
  render(<RouterProvider router={router} />)
  return router
}

describe("HomePage", () => {
  it("renders a tile for every configured client", () => {
    renderHomePage()
    for (const client of clients) {
      expect(screen.getByText(client.name)).toBeInTheDocument()
    }
  })

  it("renders tiles as clickable buttons", () => {
    renderHomePage()
    for (const client of clients) {
      expect(screen.getByText(client.name).closest("button")).toBeInTheDocument()
    }
  })

  it("shows the page heading", () => {
    renderHomePage()
    expect(screen.getByRole("heading", { name: /version release graph/i })).toBeInTheDocument()
  })

  it("navigates to /client/:id when a tile is clicked", async () => {
    const router = renderHomePage()
    const firstClient = clients[0]
    await userEvent.click(screen.getByText(firstClient.name))
    expect(router.state.location.pathname).toBe(`/client/${firstClient.id}`)
  })

  it("navigates to the correct client when the second tile is clicked", async () => {
    const router = renderHomePage()
    if (clients.length < 2) return
    const secondClient = clients[1]
    await userEvent.click(screen.getByText(secondClient.name))
    expect(router.state.location.pathname).toBe(`/client/${secondClient.id}`)
  })
})
