"use client";

import { motion } from "framer-motion";
import { useReduced } from "@/lib/motion";
import TaskCard from "@/components/TaskCard";
import type { ScoredTask } from "@/lib/types";

/**
 * TaskList — the ranked task list with the page-load stagger from
 * lib/motion.ts (DESIGN.md §4.1). New tasks fade up as they're added.
 */
export default function TaskList({ tasks }: { tasks: ScoredTask[] }) {
  const { stagger, fadeUp } = useReduced();

  return (
    <motion.ul
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {tasks.map((task) => (
        <motion.li key={task.id} variants={fadeUp} layout>
          <TaskCard task={task} />
        </motion.li>
      ))}
    </motion.ul>
  );
}
