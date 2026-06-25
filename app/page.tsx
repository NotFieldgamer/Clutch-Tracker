import FoundationPreview from "@/components/FoundationPreview";

export default function Home() {
  return (
    <main className="relative mx-auto w-full max-w-5xl px-6">
      {/* Hero */}
      <section className="flex min-h-[80vh] flex-col items-center justify-center text-center">
        {/* eyebrow — the agent's signal, used sparingly */}
        <p className="mb-7 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-faint">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "var(--agent)", boxShadow: "0 0 10px var(--agent-glow)" }}
          />
          Autonomous deadline rescue
        </p>

        <h1
          className="font-display font-semibold leading-[0.95] tracking-[-0.03em] text-text"
          style={{ fontSize: "clamp(3rem, 11vw, 7.5rem)" }}
        >
          Clutch
        </h1>

        <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-muted sm:text-xl">
          It doesn&rsquo;t remind you &mdash;{" "}
          <span className="text-text">it does the work.</span>
        </p>
      </section>

      {/* Temporary: design-foundation primitives preview */}
      <FoundationPreview />
    </main>
  );
}
