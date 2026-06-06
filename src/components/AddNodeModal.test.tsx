import { describe, it, expect, vi } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AddNodeModal } from "./AddNodeModal"
import type { VersionNode } from "../lib/types"

function renderModal(onAdd = vi.fn(), onClose = vi.fn()) {
  render(<AddNodeModal onAdd={onAdd} onClose={onClose} />)
  return { onAdd, onClose, dialog: screen.getByRole("dialog") }
}

describe("AddNodeModal", () => {
  it("renders version input and environment select", () => {
    renderModal()
    expect(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i)).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("shows all four environments in the select", () => {
    renderModal()
    const options = screen.getAllByRole("option")
    expect(options.map((o) => o.textContent)).toEqual(["dev", "qa", "preprod", "prod"])
  })

  it("shows version error for invalid semver and does not call onAdd", async () => {
    const { onAdd } = renderModal()
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "not-a-version")
    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    expect(screen.getByText(/valid semver/i)).toBeInTheDocument()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it("clears the version error when user edits the field again", async () => {
    renderModal()
    const input = screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i)
    await userEvent.type(input, "bad")
    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    expect(screen.getByText(/valid semver/i)).toBeInTheDocument()
    await userEvent.type(input, "1")
    expect(screen.queryByText(/valid semver/i)).not.toBeInTheDocument()
  })

  it("calls onAdd with a correctly shaped VersionNode on valid submit", async () => {
    const { onAdd, onClose } = renderModal()
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "2.0.0")
    await userEvent.selectOptions(screen.getByRole("combobox"), "qa")
    await userEvent.click(screen.getByRole("button", { name: /add node/i }))

    expect(onAdd).toHaveBeenCalledOnce()
    const node: VersionNode = onAdd.mock.calls[0][0]
    expect(node.version).toBe("2.0.0")
    expect(node.highestEnv).toBe("qa")
    expect(node.build.id).toBe("manual-2.0.0-qa")
    expect(node.build.environment).toBe("qa")
    expect(node.build.tags).toContain("env:qa")
    expect(node.allBuilds).toHaveLength(1)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("calls onAdd with default env (dev) when no environment is selected", async () => {
    const { onAdd } = renderModal()
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "1.0.0")
    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    const node: VersionNode = onAdd.mock.calls[0][0]
    expect(node.highestEnv).toBe("dev")
  })

  it("includes risk:db tag and hasDbChanges when DB changes is checked", async () => {
    const { onAdd } = renderModal()
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "1.0.0")
    await userEvent.click(screen.getByLabelText(/DB changes/i))
    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    const node: VersionNode = onAdd.mock.calls[0][0]
    expect(node.build.hasDbChanges).toBe(true)
    expect(node.build.tags).toContain("risk:db")
  })

  it("includes risk:env tag and hasEnvChanges when Env vars changed is checked", async () => {
    const { onAdd } = renderModal()
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "1.0.0")
    await userEvent.click(screen.getByLabelText(/env vars changed/i))
    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    const node: VersionNode = onAdd.mock.calls[0][0]
    expect(node.build.hasEnvChanges).toBe(true)
    expect(node.build.tags).toContain("risk:env")
  })

  it("does not set risk flags when checkboxes are unchecked", async () => {
    const { onAdd } = renderModal()
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "1.0.0")
    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    const node: VersionNode = onAdd.mock.calls[0][0]
    expect(node.build.hasDbChanges).toBe(false)
    expect(node.build.hasEnvChanges).toBe(false)
    expect(node.build.tags).not.toContain("risk:db")
    expect(node.build.tags).not.toContain("risk:env")
  })

  it("trims and truncates commitSha to 7 characters", async () => {
    const { onAdd } = renderModal()
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "1.0.0")
    await userEvent.type(screen.getByPlaceholderText(/a1b2c3d/i), "abc1234defghij")
    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    const node: VersionNode = onAdd.mock.calls[0][0]
    expect(node.build.commitSha).toBe("abc1234")
  })

  it("calls onClose when Cancel is clicked", async () => {
    const { onAdd, onClose } = renderModal()
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onAdd).not.toHaveBeenCalled()
  })

  it("calls onClose when clicking the backdrop", () => {
    const { onClose } = renderModal()
    // fire directly on the backdrop element so target === currentTarget
    const backdrop = screen.getByRole("dialog").parentElement!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("does not close when clicking inside the dialog content", async () => {
    const { onClose } = renderModal()
    await userEvent.click(screen.getByRole("dialog"))
    expect(onClose).not.toHaveBeenCalled()
  })

  it("normalises semver (e.g. strips leading v)", async () => {
    const { onAdd } = renderModal()
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. 1\.2\.3/i), "v1.2.3")
    await userEvent.click(screen.getByRole("button", { name: /add node/i }))
    const node: VersionNode = onAdd.mock.calls[0][0]
    expect(node.version).toBe("1.2.3")
  })

  it("renders optional Commit SHA and Build URL fields", () => {
    const { dialog } = renderModal()
    const inputs = within(dialog).getAllByRole("textbox")
    // version + commitSha + buildUrl
    expect(inputs.length).toBeGreaterThanOrEqual(3)
  })
})
