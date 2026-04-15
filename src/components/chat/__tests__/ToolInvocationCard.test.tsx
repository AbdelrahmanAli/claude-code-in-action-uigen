import { render, within, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ToolInvocationCard } from "../ToolInvocationCard";

vi.mock("lucide-react", () => ({
  Loader2: () => <div data-testid="loader" />,
}));

afterEach(cleanup);

function makeInvocation(
  toolName: string,
  args: Record<string, unknown>,
  state: string = "call",
  result?: unknown
) {
  return { toolCallId: "test-id", toolName, args, state, result };
}

describe("ToolInvocationCard", () => {
  describe("str_replace_editor — pending", () => {
    it.each([
      ["create",      "Creating Button.tsx"],
      ["str_replace", "Editing Button.tsx"],
      ["insert",      "Editing Button.tsx"],
      ["view",        "Reading Button.tsx"],
      ["undo_edit",   "Undoing edit in Button.tsx"],
    ])("command=%s shows %s and loader", (command, label) => {
      const { container } = render(
        <ToolInvocationCard
          toolInvocation={makeInvocation("str_replace_editor", {
            command,
            path: "/components/Button.tsx",
          })}
        />
      );
      const scope = within(container);
      expect(scope.getByText(label)).toBeDefined();
      expect(scope.getByTestId("loader")).toBeDefined();
      expect(container.querySelector(".bg-emerald-500")).toBeNull();
    });
  });

  describe("str_replace_editor — done", () => {
    it.each([
      ["create",      "Created Button.tsx"],
      ["str_replace", "Edited Button.tsx"],
      ["insert",      "Edited Button.tsx"],
      ["view",        "Read Button.tsx"],
      ["undo_edit",   "Undid edit in Button.tsx"],
    ])("command=%s shows %s and green dot", (command, label) => {
      const { container } = render(
        <ToolInvocationCard
          toolInvocation={makeInvocation(
            "str_replace_editor",
            { command, path: "/components/Button.tsx" },
            "result",
            "ok"
          )}
        />
      );
      const scope = within(container);
      expect(scope.getByText(label)).toBeDefined();
      expect(container.querySelector(".bg-emerald-500")).toBeDefined();
      expect(scope.queryByTestId("loader")).toBeNull();
    });
  });

  describe("file_manager", () => {
    it("rename pending shows both filenames and loader", () => {
      const { container } = render(
        <ToolInvocationCard
          toolInvocation={makeInvocation("file_manager", {
            command: "rename",
            path: "/src/Old.tsx",
            new_path: "/src/New.tsx",
          })}
        />
      );
      const scope = within(container);
      expect(scope.getByText("Renaming Old.tsx → New.tsx")).toBeDefined();
      expect(scope.getByTestId("loader")).toBeDefined();
    });

    it("rename done shows both filenames and green dot", () => {
      const { container } = render(
        <ToolInvocationCard
          toolInvocation={makeInvocation(
            "file_manager",
            { command: "rename", path: "/src/Old.tsx", new_path: "/src/New.tsx" },
            "result",
            "ok"
          )}
        />
      );
      const scope = within(container);
      expect(scope.getByText("Renamed Old.tsx → New.tsx")).toBeDefined();
      expect(container.querySelector(".bg-emerald-500")).toBeDefined();
      expect(scope.queryByTestId("loader")).toBeNull();
    });

    it("delete pending shows filename and loader", () => {
      const { container } = render(
        <ToolInvocationCard
          toolInvocation={makeInvocation("file_manager", {
            command: "delete",
            path: "/src/Button.tsx",
          })}
        />
      );
      const scope = within(container);
      expect(scope.getByText("Deleting Button.tsx")).toBeDefined();
      expect(scope.getByTestId("loader")).toBeDefined();
    });

    it("delete done shows filename and green dot", () => {
      const { container } = render(
        <ToolInvocationCard
          toolInvocation={makeInvocation(
            "file_manager",
            { command: "delete", path: "/src/Button.tsx" },
            "result",
            "ok"
          )}
        />
      );
      const scope = within(container);
      expect(scope.getByText("Deleted Button.tsx")).toBeDefined();
      expect(container.querySelector(".bg-emerald-500")).toBeDefined();
      expect(scope.queryByTestId("loader")).toBeNull();
    });
  });

  describe("basename extraction", () => {
    it("extracts filename from a deeply nested path", () => {
      const { container } = render(
        <ToolInvocationCard
          toolInvocation={makeInvocation("str_replace_editor", {
            command: "create",
            path: "/components/chat/Button.tsx",
          })}
        />
      );
      expect(within(container).getByText("Creating Button.tsx")).toBeDefined();
    });

    it("handles a path with no leading slash", () => {
      const { container } = render(
        <ToolInvocationCard
          toolInvocation={makeInvocation("str_replace_editor", {
            command: "create",
            path: "Button.tsx",
          })}
        />
      );
      expect(within(container).getByText("Creating Button.tsx")).toBeDefined();
    });
  });

  describe("fallback behaviour", () => {
    it("unknown tool pending shows raw tool name and loader", () => {
      const { container } = render(
        <ToolInvocationCard
          toolInvocation={makeInvocation("some_other_tool", {})}
        />
      );
      const scope = within(container);
      expect(scope.getByText("some_other_tool")).toBeDefined();
      expect(scope.getByTestId("loader")).toBeDefined();
    });

    it("unknown tool done shows raw tool name and green dot", () => {
      const { container } = render(
        <ToolInvocationCard
          toolInvocation={makeInvocation("some_other_tool", {}, "result", "ok")}
        />
      );
      const scope = within(container);
      expect(scope.getByText("some_other_tool")).toBeDefined();
      expect(container.querySelector(".bg-emerald-500")).toBeDefined();
      expect(scope.queryByTestId("loader")).toBeNull();
    });

    it("str_replace_editor with no command falls back to tool name", () => {
      const { container } = render(
        <ToolInvocationCard
          toolInvocation={makeInvocation("str_replace_editor", {
            path: "/App.jsx",
          })}
        />
      );
      expect(within(container).getByText("str_replace_editor")).toBeDefined();
    });
  });
});
