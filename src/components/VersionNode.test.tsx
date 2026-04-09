import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { VersionNodeComponent } from "./VersionNode"
import type { VersionNode } from "../lib/types"

// ---------------------------------------------------------------------------
// Mock @xyflow/react — we only need Handle, Position, and NodeResizer stubs
// ---------------------------------------------------------------------------
vi.mock("@xyflow/react", () => {
  const Position = {
    Top: "top",
    Bottom: "bottom",
    Left: "left",
    Right: "right",
  }

  function Handle({ id, type, style }: { id: string; type: string; style?: React.CSSProperties }) {
    return (
      <div
        data-testid={`handle-${type}-${id}`}
        data-handle-id={id}
        data-handle-type={type}
        style={style}
      />
    )
  }

  function NodeResizer({
    isVisible,
    minWidth,
    minHeight,
  }: {
    isVisible?: boolean
    minWidth?: number
    minHeight?: number
  }) {
    return (
      <div
        data-testid="node-resizer"
        data-visible={isVisible}
        data-min-width={minWidth}
        data-min-height={minHeight}
      />
    )
  }

  return { Handle, Position, NodeResizer }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<VersionNode> = {}): VersionNode {
  const build = {
    id: "100",
    version: "1.0.0",
    environment: "prod" as const,
    timestamp: "2024-03-15T14:32:00Z",
    buildUrl: "https://dev.azure.com/org/proj/_build/results?buildId=100",
    commitSha: "abc1234",
    tags: [],
    hasDbChanges: false,
    hasEnvChanges: false,
    ...overrides.build,
  }

  return {
    version: "1.0.0",
    highestEnv: "prod",
    build,
    allBuilds: [build],
    ...overrides,
  }
}

function renderNode(
  nodeOverrides: Partial<VersionNode> = {},
  activeHandles: Set<string> = new Set()
) {
  const onClick = vi.fn()
  const node = makeNode(nodeOverrides)
  const result = render(
    <VersionNodeComponent data={{ versionNode: node, onClick, activeHandles }} />
  )
  return { ...result, onClick, node }
}

// Need React in scope for JSX
import React from "react"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VersionNodeComponent", () => {
  describe("basic rendering", () => {
    it("displays the version string", () => {
      renderNode()
      expect(screen.getByText("1.0.0")).toBeInTheDocument()
    })

    it("displays the highestEnv badge", () => {
      renderNode()
      expect(screen.getByText("prod")).toBeInTheDocument()
    })

    it("formats and displays the build timestamp", () => {
      renderNode()
      // timestamp "2024-03-15T14:32:00Z" → locale "en-GB"
      expect(screen.getByText(/15\/03\/2024/)).toBeInTheDocument()
    })
  })

  describe("risk flags", () => {
    it("shows DB changes indicator when hasDbChanges is true", () => {
      renderNode({ build: { hasDbChanges: true } as any })
      expect(screen.getByText(/DB changes/)).toBeInTheDocument()
    })

    it("shows Env vars changed indicator when hasEnvChanges is true", () => {
      renderNode({ build: { hasEnvChanges: true } as any })
      expect(screen.getByText(/Env vars changed/)).toBeInTheDocument()
    })

    it("hides both indicators when no risk flags", () => {
      renderNode()
      expect(screen.queryByText(/DB changes/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Env vars changed/)).not.toBeInTheDocument()
    })
  })

  describe("onClick behaviour", () => {
    it("calls onClick when clicked normally", () => {
      const { onClick, node } = renderNode()
      fireEvent.click(screen.getByText("1.0.0").closest("div")!.parentElement!)
      expect(onClick).toHaveBeenCalledWith(node)
    })

    it("suppresses onClick on Ctrl+click (multi-select)", () => {
      const { onClick } = renderNode()
      fireEvent.click(screen.getByText("1.0.0").closest("div")!.parentElement!, {
        ctrlKey: true,
      })
      expect(onClick).not.toHaveBeenCalled()
    })

    it("suppresses onClick on Meta+click (multi-select on Mac)", () => {
      const { onClick } = renderNode()
      fireEvent.click(screen.getByText("1.0.0").closest("div")!.parentElement!, {
        metaKey: true,
      })
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe("NodeResizer", () => {
    it("renders a NodeResizer", () => {
      renderNode()
      expect(screen.getByTestId("node-resizer")).toBeInTheDocument()
    })

    it("NodeResizer is hidden when not hovered", () => {
      renderNode()
      expect(screen.getByTestId("node-resizer")).toHaveAttribute("data-visible", "false")
    })

    it("NodeResizer becomes visible on mouse enter", () => {
      renderNode()
      const wrapper = screen.getByText("1.0.0").closest("div")!.parentElement!
      fireEvent.mouseEnter(wrapper)
      expect(screen.getByTestId("node-resizer")).toHaveAttribute("data-visible", "true")
    })

    it("NodeResizer hides again on mouse leave", () => {
      renderNode()
      const wrapper = screen.getByText("1.0.0").closest("div")!.parentElement!
      fireEvent.mouseEnter(wrapper)
      fireEvent.mouseLeave(wrapper)
      expect(screen.getByTestId("node-resizer")).toHaveAttribute("data-visible", "false")
    })

    it("NodeResizer minWidth is 220 (multiple of snap grid 20)", () => {
      renderNode()
      expect(screen.getByTestId("node-resizer")).toHaveAttribute("data-min-width", "220")
    })

    it("NodeResizer minHeight is 100 (multiple of snap grid 20)", () => {
      renderNode()
      expect(screen.getByTestId("node-resizer")).toHaveAttribute("data-min-height", "100")
    })
  })

  describe("anchor handles", () => {
    it("renders both target and source handles for all 4 sides (8 total)", () => {
      renderNode()
      expect(screen.getAllByTestId(/^handle-(target|source)-(top|bottom|left|right)$/)).toHaveLength(8)
    })

    it("inactive handles have opacity 0", () => {
      renderNode({}, new Set()) // no active handles
      const handles = screen.getAllByTestId(/^handle-/)
      handles.forEach((h) => {
        const opacity = h.style.opacity
        expect(opacity === "0" || opacity === "").toBeTruthy()
      })
    })

    it("active handles are fully visible with background color", () => {
      renderNode({}, new Set(["top"]))
      // There are 2 handles for "top" (source + target), both should be visible
      const topHandles = screen.getAllByTestId(/^handle-(target|source)-top$/)
      expect(topHandles.length).toBe(2)
      topHandles.forEach((h) => {
        expect(h.style.opacity).toBe("1")
        expect(h.style.background).toBeTruthy()
      })
    })

    it("only the specified side's handles are visible when one handle is active", () => {
      renderNode({}, new Set(["bottom"]))
      const topHandles = screen.getAllByTestId(/^handle-(target|source)-top$/)
      topHandles.forEach((h) => {
        expect(h.style.opacity === "0" || h.style.opacity === "").toBeTruthy()
      })
      const bottomHandles = screen.getAllByTestId(/^handle-(target|source)-bottom$/)
      bottomHandles.forEach((h) => {
        expect(h.style.opacity).toBe("1")
      })
    })
  })
})
