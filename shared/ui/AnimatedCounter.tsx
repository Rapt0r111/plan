"use client";
/**
 * @file AnimatedCounter.tsx — shared/ui
 *
 * Renders a number with a vertical slide animation whenever `value` changes.
 * Direction: counting up → new value slides in from top.
 *            counting down → new value slides in from bottom.
 *
 * IMPLEMENTATION NOTE — why setState during render:
 *
 *  We need `direction` and `prev` to be one render behind `value` so the
 *  animation initial/exit positions are correct at the moment Framer mounts
 *  the new key. Three alternatives were ruled out:
 *
 *   ✗ useEffect + setState  — react-hooks/set-state-in-effect lint error
 *   ✗ read ref during render — react-hooks/refs lint error
 *   ✗ write ref during render — react-hooks/refs lint error
 *
 *  The React docs explicitly recommend calling setState *during render* (behind
 *  a condition) as the correct way to derive state from a changing prop:
 *  https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
 *
 *  React detects the in-render setState, discards the current render output,
 *  and immediately re-renders with the new state — no extra commit, no
 *  cascading effect, no lint violation. This is distinct from calling setState
 *  inside useEffect (which does cause cascading renders and trips the linter).
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  value: number;
  className?: string;
}

interface CounterState {
  prev: number;
  direction: 1 | -1;
}

export function AnimatedCounter({ value, className }: Props) {
  const [state, setState] = useState<CounterState>({ prev: value, direction: 1 });

  // Recommended React pattern: adjust state derived from a prop during render.
  // Guarded by the condition so it only fires when value actually changes,
  // preventing an infinite loop. React will restart the render synchronously
  // with the updated state — no useEffect, no ref read/write during render.
  if (value !== state.prev) {
    setState({
      prev: value,
      direction: value > state.prev ? 1 : -1,
    });
  }

  return (
    <span
      className={`relative inline-block overflow-hidden ${className}`}
      style={{ lineHeight: 1 }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: state.direction * -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: state.direction * 16, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}