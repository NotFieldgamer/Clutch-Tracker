"use client";

import { motion, LayoutGroup } from "framer-motion";
import { useReduced, spring } from "@/lib/motion";
import TaskCard from "@/components/TaskCard";
import type { Task } from "@/lib/types";

export interface ScoredCard {
  task: Task;
  risk: number; // effective 0..1 (de-escalated once rescued)
  reason: string;
  rescued: boolean;
}

/**
 * TaskList — the ranked list with the page-load stagger (DESIGN.md §4.1) and
 * live re-ranking: cards `layout="position"` inside a LayoutGroup, so when a
 * rescue drops a task's risk and it re-sorts, the card physically slides into
 * its new position (spring 500/40, §4.3). Reduced motion disables the slide.
 */
export default function TaskList({
  cards,
  approvedArtifacts,
  onToggleApprove,
  onDelete,
}: {
  cards: ScoredCard[];
  approvedArtifacts: Set<string>;
  onToggleApprove: (artifactId: string) => void;
  onDelete?: (taskId: string) => void;
}) {
  const { stagger, fadeUp, prefersReduced } = useReduced();

  return (
    <LayoutGroup>
      <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-4">
        {cards.map((c) => (
          <motion.li
            key={c.task.id}
            variants={fadeUp}
            layout={prefersReduced ? false : "position"}
            transition={{ layout: spring.layout }}
          >
            <TaskCard
              task={c.task}
              risk={c.risk}
              reason={c.reason}
              rescued={c.rescued}
              approvedArtifacts={approvedArtifacts}
              onToggleApprove={onToggleApprove}
              onDelete={onDelete}
            />
          </motion.li>
        ))}
      </motion.ul>
    </LayoutGroup>
  );
}
