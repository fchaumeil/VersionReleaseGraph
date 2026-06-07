import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the hook
// ---------------------------------------------------------------------------

const mockIsMockMode = vi.hoisted(() => ({ value: false }))
const mockCheckAdoConnection = vi.hoisted(() => vi.fn<() => Promise<boolean>>())

vi.mock("../lib/azureDevOps", () => ({
  get isMockMode() { return mockIsMockMode.value },
  checkAdoConnection: mockCheckAdoConnection,
}))

// Import after mocks are wired
import { useAdoStatus } from "./useAdoStatus"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAdoStatus", () => {
  beforeEach(() => {
    mockIsMockMode.value = false
    mockCheckAdoConnection.mockReset()
  })

  it("returns 'mock' immediately when isMockMode is true", () => {
    mockIsMockMode.value = true
    const { result } = renderHook(() => useAdoStatus())
    expect(result.current).toBe("mock")
  })

  it("does not call checkAdoConnection when in mock mode", () => {
    mockIsMockMode.value = true
    renderHook(() => useAdoStatus())
    expect(mockCheckAdoConnection).not.toHaveBeenCalled()
  })

  it("returns 'checking' as the initial state when not in mock mode", () => {
    // Never resolves — keeps the hook in the checking state
    mockCheckAdoConnection.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useAdoStatus())
    expect(result.current).toBe("checking")
  })

  it("transitions to 'connected' when checkAdoConnection resolves true", async () => {
    mockCheckAdoConnection.mockResolvedValue(true)
    const { result } = renderHook(() => useAdoStatus())
    await act(async () => {})
    expect(result.current).toBe("connected")
  })

  it("transitions to 'error' when checkAdoConnection resolves false", async () => {
    mockCheckAdoConnection.mockResolvedValue(false)
    const { result } = renderHook(() => useAdoStatus())
    await act(async () => {})
    expect(result.current).toBe("error")
  })

  it("calls checkAdoConnection exactly once on mount", async () => {
    mockCheckAdoConnection.mockResolvedValue(true)
    renderHook(() => useAdoStatus())
    await act(async () => {})
    expect(mockCheckAdoConnection).toHaveBeenCalledOnce()
  })
})
