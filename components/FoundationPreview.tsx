"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import GlassPanel from "@/components/ui/GlassPanel";
import Button from "@/components/ui/Button";
import RiskMeter from "@/components/ui/RiskMeter";
import ProgressRing from "@/components/ui/ProgressRing";
import CountUp from "@/components/ui/CountUp";
import { useReduced } from "@/lib/motion";

/**
 * Temporary foundation preview — eyeball every primitive in one place.
 * Remove this once the real Today / Rescue view replaces it.
 */

const HEAT = [
  { label: "On track", value: 0.18 },
  { label: "Due ~3 days", value: 0.45 },
  { label: "Due ~1 day", value: 0.68 },
  { label: "Overdue", value: 0.93 },
];

export default function FoundationPreview() {
  const { stagger, fadeUp } = useReduced();
  const [rescued, setRescued] = useState(false);

  return (
    <section className="pb-28 pt-8">
      <header className="mb-8">
        <p className="t-caption mb-2">Design foundation</p>
        <h2 className="t-display-l text-text">Primitives</h2>
        <p className="t-body mt-2 max-w-xl text-muted">
          The reusable surface every later screen inherits — color that encodes
          risk, motion that resolves it. Temporary preview.
        </p>
      </header>

      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="grid grid-cols-1 gap-5 md:grid-cols-2"
      >
        {/* Typography */}
        <motion.div variants={fadeUp}>
          <GlassPanel className="h-full">
            <p className="t-caption mb-4">Type scale</p>
            <div className="space-y-3">
              <p className="t-display-l text-text">Display L</p>
              <p className="t-h2 text-text">Heading 2</p>
              <p className="t-body-l text-text">Body large — the agent has it handled.</p>
              <p className="t-body text-muted">Body — secondary copy sits in muted.</p>
              <p className="t-label text-muted">LABEL · UI controls</p>
              <p className="t-mono text-muted">mono · 18:42 · scheduled</p>
              <p className="t-caption">Caption / overline</p>
            </div>
          </GlassPanel>
        </motion.div>

        {/* Buttons */}
        <motion.div variants={fadeUp}>
          <GlassPanel className="h-full">
            <p className="t-caption mb-4">Buttons</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Rescue my week</Button>
              <Button variant="ghost">Connect calendar</Button>
              <Button variant="subtle">Dismiss</Button>
            </div>
            <p className="t-body mt-4 text-faint">
              Hover the primary CTA for the agent glow; press for the tap dip.
            </p>
          </GlassPanel>
        </motion.div>

        {/* Risk heat scale */}
        <motion.div variants={fadeUp}>
          <GlassPanel className="h-full">
            <p className="t-caption mb-4">Risk heat scale</p>
            <div className="space-y-3.5">
              {HEAT.map((h) => (
                <div key={h.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="t-label text-muted">{h.label}</span>
                    <span className="t-mono text-faint">{Math.round(h.value * 100)}</span>
                  </div>
                  <RiskMeter value={h.value} aria-label={h.label} />
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>

        {/* Interactive rescue — ProgressRing + RiskMeter ease-down + CountUp */}
        <motion.div variants={fadeUp}>
          <GlassPanel className="flex h-full flex-col">
            <p className="t-caption mb-4">Rescue · live</p>
            <div className="flex items-center gap-5">
              <ProgressRing value={rescued ? 100 : 22} color={rescued ? "var(--calm)" : "var(--agent)"} />
              <div className="min-w-0 flex-1">
                <p className="t-label mb-1.5 text-muted">Deadline risk</p>
                <RiskMeter value={rescued ? 0.12 : 0.93} />
                <p className="mt-3 flex items-baseline gap-2">
                  <CountUp value={rescued ? 142 : 0} className="t-display-l text-text" />
                  <span className="t-label text-muted">min reclaimed</span>
                </p>
              </div>
            </div>
            <div className="mt-5">
              <Button
                variant={rescued ? "ghost" : "primary"}
                onClick={() => setRescued((r) => !r)}
              >
                {rescued ? "Reset" : "Run rescue"}
              </Button>
            </div>
          </GlassPanel>
        </motion.div>

        {/* GlassPanel variants */}
        <motion.div variants={fadeUp} className="md:col-span-2">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <GlassPanel variant="card">
              <p className="t-caption mb-2">GlassPanel · card</p>
              <p className="t-body text-muted">Content surface for task cards and key panels.</p>
            </GlassPanel>
            <GlassPanel variant="rail">
              <p className="t-caption mb-2">GlassPanel · rail</p>
              <p className="t-mono text-muted">› docked operations panel</p>
            </GlassPanel>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
