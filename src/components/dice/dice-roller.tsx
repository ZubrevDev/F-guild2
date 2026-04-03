"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type DiceState = "idle" | "rolling" | "revealing" | "result";

interface DiceRollerProps {
  /** The final d20 roll value (1-20). */
  result: number | null;
  /** Whether the dice is currently rolling. */
  rolling: boolean;
  /** Called when the rolling + reveal animation completes. */
  onRollComplete?: () => void;
  /** Optional className for the outer wrapper. */
  className?: string;
}

/** Duration (ms) of each animation phase. */
const ROLL_DURATION = 1500;
const REVEAL_DURATION = 600;

/**
 * Animated d20 dice visualization.
 *
 * Uses CSS transforms and keyframe animations to create a 3D-style
 * tumbling effect, with special treatments for critical hit (20) and
 * critical fail (1).
 */
export function DiceRoller({
  result,
  rolling,
  onRollComplete,
  className,
}: DiceRollerProps) {
  const [state, setState] = useState<DiceState>("idle");
  const [displayValue, setDisplayValue] = useState<number | null>(null);
  const shuffleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRollingRef = useRef(false);

  // Detect rolling edge (false -> true) to kick off the animation sequence.
  useEffect(() => {
    if (rolling && !prevRollingRef.current) {
      setState("rolling");
      setDisplayValue(null);

      // Shuffle random numbers while rolling for visual effect.
      shuffleRef.current = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 20) + 1);
      }, 80);
    }
    prevRollingRef.current = rolling;
  }, [rolling]);

  // When rolling stops and we have a result, transition through states.
  useEffect(() => {
    if (state === "rolling" && !rolling && result !== null) {
      // Stop the shuffle.
      if (shuffleRef.current) {
        clearInterval(shuffleRef.current);
        shuffleRef.current = null;
      }

      // Transition: rolling -> revealing -> result
      const revealTimer = setTimeout(() => {
        setDisplayValue(result);
        setState("revealing");
      }, Math.max(0, ROLL_DURATION - 200));

      const resultTimer = setTimeout(() => {
        setState("result");
        onRollComplete?.();
      }, ROLL_DURATION + REVEAL_DURATION);

      return () => {
        clearTimeout(revealTimer);
        clearTimeout(resultTimer);
      };
    }
  }, [state, rolling, result, onRollComplete]);

  // Clean up interval on unmount.
  useEffect(() => {
    return () => {
      if (shuffleRef.current) clearInterval(shuffleRef.current);
    };
  }, []);

  const isCriticalHit = state === "result" && result === 20;
  const isCriticalFail = state === "result" && result === 1;

  const shownValue =
    state === "idle" ? (result ?? 20) : (displayValue ?? "?");

  return (
    <div
      className={cn("flex flex-col items-center gap-3", className)}
      role="img"
      aria-label={
        result !== null
          ? `D20 dice showing ${result}`
          : "D20 dice ready to roll"
      }
    >
      {/* Dice body */}
      <div
        className={cn(
          "dice-body relative flex items-center justify-center",
          "size-28 select-none rounded-2xl border-2 text-3xl font-bold",
          "transition-shadow duration-300",
          // Perspective container
          "[perspective:600px]",
          // Base colours
          "border-border bg-card text-card-foreground",
          // State-specific animations
          state === "rolling" && "dice-rolling",
          state === "revealing" && "dice-reveal",
          // Critical effects
          isCriticalHit &&
            "dice-crit-hit border-yellow-400 shadow-[0_0_24px_4px_rgba(250,204,21,0.5)]",
          isCriticalFail &&
            "dice-crit-fail border-red-500 shadow-[0_0_24px_4px_rgba(239,68,68,0.45)]",
        )}
      >
        {/* Inner face — receives the 3D transform */}
        <span
          className={cn(
            "dice-face z-10 tabular-nums",
            state === "rolling" && "dice-face-tumble",
            state === "revealing" && "animate-in zoom-in duration-300",
            isCriticalHit && "text-yellow-400",
            isCriticalFail && "text-red-500",
          )}
        >
          {shownValue}
        </span>

        {/* D20 shape hint — rotated square behind the number */}
        <div
          className={cn(
            "pointer-events-none absolute inset-3 rotate-45 rounded-md border border-border/40",
            state === "rolling" && "dice-shape-spin",
          )}
        />
      </div>

      {/* Status label */}
      <span
        className={cn(
          "text-sm font-medium",
          state === "idle" && "text-muted-foreground",
          state === "rolling" && "animate-pulse text-muted-foreground",
          isCriticalHit && "text-yellow-500 font-bold",
          isCriticalFail && "text-red-500 font-bold",
          state === "result" && !isCriticalHit && !isCriticalFail &&
            "text-foreground",
        )}
      >
        {state === "idle" && "Ready"}
        {state === "rolling" && "Rolling\u2026"}
        {state === "revealing" && "Revealing\u2026"}
        {state === "result" && isCriticalHit && "CRITICAL HIT!"}
        {state === "result" && isCriticalFail && "CRITICAL FAIL!"}
        {state === "result" && !isCriticalHit && !isCriticalFail && (
          <>Result: {result}</>
        )}
      </span>
    </div>
  );
}

/**
 * Hook that manages the roll lifecycle, suitable for pairing with
 * DiceRoller and a tRPC mutation.
 */
export function useDiceAnimation() {
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const startRoll = useCallback(() => {
    setRolling(true);
    setResult(null);
  }, []);

  const deliverResult = useCallback((value: number) => {
    setResult(value);
    setRolling(false);
  }, []);

  const reset = useCallback(() => {
    setRolling(false);
    setResult(null);
  }, []);

  return { rolling, result, startRoll, deliverResult, reset };
}
