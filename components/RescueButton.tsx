"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2 } from "lucide-react";
import Button from "@/components/ui/Button";

/**
 * RescueButton — placeholder for the hero "Rescue my week" CTA. The agent loop
 * arrives in the next step; for now it sets expectations in the agent's voice
 * instead of doing nothing on click.
 */
export default function RescueButton({ disabled }: { disabled?: boolean }) {
  const [hinted, setHinted] = useState(false);

  return (
    <div className="flex flex-col items-start gap-2.5">
      <Button variant="primary" disabled={disabled} onClick={() => setHinted(true)}>
        <Wand2 className="h-4 w-4" /> Rescue my week
      </Button>

      <AnimatePresence>
        {hinted && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="t-mono"
            style={{ color: "var(--agent-2)" }}
          >
            ▸ The agent wires up next — it&rsquo;ll plan, schedule, and draft from here.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
