"use client";

import { Loader2 } from "lucide-react";

interface ToolInvocationCardProps {
  toolInvocation: {
    toolCallId: string;
    toolName: string;
    state: string;
    args: Record<string, unknown>;
    result?: unknown;
  };
}

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

type LabelPair = { pending: string; done: string };

function getLabel(toolName: string, args: Record<string, unknown>): LabelPair {
  const file = basename(typeof args.path === "string" ? args.path : "");

  if (toolName === "str_replace_editor") {
    switch (args.command) {
      case "create":      return { pending: `Creating ${file}`,        done: `Created ${file}` };
      case "str_replace": return { pending: `Editing ${file}`,         done: `Edited ${file}` };
      case "insert":      return { pending: `Editing ${file}`,         done: `Edited ${file}` };
      case "view":        return { pending: `Reading ${file}`,         done: `Read ${file}` };
      case "undo_edit":   return { pending: `Undoing edit in ${file}`, done: `Undid edit in ${file}` };
    }
  }

  if (toolName === "file_manager") {
    const newFile = basename(typeof args.new_path === "string" ? args.new_path : "");
    switch (args.command) {
      case "rename": return { pending: `Renaming ${file} → ${newFile}`, done: `Renamed ${file} → ${newFile}` };
      case "delete": return { pending: `Deleting ${file}`,              done: `Deleted ${file}` };
    }
  }

  return { pending: toolName, done: toolName };
}

export function ToolInvocationCard({ toolInvocation }: ToolInvocationCardProps) {
  // Both state and result must be present to consider the tool call complete
  const isDone = toolInvocation.state === "result" && toolInvocation.result !== undefined;
  const { pending, done } = getLabel(toolInvocation.toolName, toolInvocation.args);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-neutral-700">{done}</span>
        </>
      ) : (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          <span className="text-neutral-700">{pending}</span>
        </>
      )}
    </div>
  );
}
