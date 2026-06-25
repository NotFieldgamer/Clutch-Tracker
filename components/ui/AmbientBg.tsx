/**
 * AmbientBg — placeholder for the living atmosphere behind the app (DESIGN.md §4).
 *
 * Two very faint radial gradients (one --agent violet, one --calm green) over
 * --ink, plus a subtle grain. Static for now; the slow drift + reduced-motion
 * pause arrive with the motion pass. Purely decorative, so aria-hidden and
 * pointer-events-none — it never intercepts focus or clicks.
 */
export default function AmbientBg() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "var(--ink)" }}
    >
      {/* agent violet glow, upper-left */}
      <div
        className="absolute -left-[10%] -top-[15%] h-[60vmax] w-[60vmax] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 60%)",
        }}
      />
      {/* calm green glow, lower-right */}
      <div
        className="absolute -bottom-[20%] -right-[10%] h-[55vmax] w-[55vmax] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(52,211,153,0.05) 0%, transparent 60%)",
        }}
      />
      {/* faint grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
