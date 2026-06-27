"use client";

import { useState } from "react";
import { Copy, Check, RotateCcw } from "lucide-react";
import type { Artifact } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  outline: "Outline",
  draft: "First draft",
  prep: "Prep questions",
  email: "Email draft",
  note: "Note",
};

/** Email artifacts are stored as "Subject: …\n\n{body}" (agent/tools.ts). */
function parseEmail(content: string): { subject: string; body: string } {
  const m = content.match(/^Subject:\s*([^\n]*)\n+([\s\S]*)$/);
  if (m) return { subject: m[1].trim(), body: m[2].trim() };
  return { subject: "", body: content };
}

// min-h-[44px] keeps the hit area on the >=44px touch floor (DESIGN.md §8) even
// though the label is small — these are the primary per-artifact controls.
const actionBtn =
  "inline-flex min-h-[44px] items-center gap-1 rounded-[6px] px-3 py-1 t-label outline-none " +
  "transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

/**
 * ArtifactView — one generated artifact inside a TaskCard (CLAUDE.md cap. 3).
 * Copy + an approve/undo toggle; email shows subject + body distinctly.
 */
export default function ArtifactView({
  artifact,
  approved,
  onToggleApprove,
}: {
  artifact: Artifact;
  approved: boolean;
  onToggleApprove: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const email = artifact.kind === "email" ? parseEmail(artifact.content) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked (insecure context) — no-op */
    }
  }

  return (
    <div
      className="rounded-[var(--radius-sm)] border p-3 transition-colors"
      style={{
        borderColor: approved
          ? "color-mix(in srgb, var(--calm) 45%, transparent)"
          : "var(--border)",
        background: approved
          ? "color-mix(in srgb, var(--calm) 7%, var(--ink-2))"
          : "color-mix(in srgb, var(--ink-2) 60%, transparent)",
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="t-caption inline-flex items-center gap-1.5">
          {approved && <Check className="h-3 w-3" style={{ color: "var(--calm)" }} />}
          {approved ? "Approved" : KIND_LABEL[artifact.kind] ?? "Artifact"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copy}
            className={actionBtn}
            style={{ color: copied ? "var(--calm)" : "var(--muted)" }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onToggleApprove}
            className={actionBtn}
            style={{ color: approved ? "var(--muted)" : "var(--calm)" }}
          >
            {approved ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" /> Undo
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" /> Approve
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {email ? (
          <div className="space-y-2">
            {email.subject && (
              <div>
                <p className="t-label text-faint">Subject</p>
                <p className="t-body text-text">{email.subject}</p>
              </div>
            )}
            <div>
              <p className="t-label text-faint">Body</p>
              <pre className="t-body whitespace-pre-wrap break-words font-sans text-muted">
                {email.body}
              </pre>
            </div>
          </div>
        ) : (
          <pre className="t-body whitespace-pre-wrap break-words font-sans text-muted">
            {artifact.content}
          </pre>
        )}
      </div>
    </div>
  );
}
