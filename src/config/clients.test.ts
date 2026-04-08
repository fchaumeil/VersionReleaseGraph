import { describe, it, expect } from "vitest"
import { clients } from "./clients"

// Epic 3.1 — Client config file

describe("clients config", () => {
  it("exports a non-empty array", () => {
    expect(Array.isArray(clients)).toBe(true)
    expect(clients.length).toBeGreaterThan(0)
  })

  it("each client has a non-empty string id", () => {
    for (const client of clients) {
      expect(typeof client.id).toBe("string")
      expect(client.id.length).toBeGreaterThan(0)
    }
  })

  it("each client has a non-empty string name", () => {
    for (const client of clients) {
      expect(typeof client.name).toBe("string")
      expect(client.name.length).toBeGreaterThan(0)
    }
  })

  it("each client has at least one pipeline ID", () => {
    for (const client of clients) {
      expect(Array.isArray(client.azurePipelineIds)).toBe(true)
      expect(client.azurePipelineIds.length).toBeGreaterThan(0)
    }
  })

  it("all pipeline IDs are positive integers", () => {
    for (const client of clients) {
      for (const id of client.azurePipelineIds) {
        expect(Number.isInteger(id)).toBe(true)
        expect(id).toBeGreaterThan(0)
      }
    }
  })

  it("client ids are unique", () => {
    const ids = clients.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
