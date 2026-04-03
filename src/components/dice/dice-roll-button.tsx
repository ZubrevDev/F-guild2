"use client";

import { useCallback } from "react";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { DiceRoller, useDiceAnimation } from "./dice-roller";
import { cn } from "@/lib/utils";

interface DiceRollButtonProps {
  /** UUID of the character performing the roll. */
  characterId: string;
  /** Roll context string (e.g. "attack", "stealth"). */
  context: string;
  /** Difficulty class for the roll. */
  dc: number;
  /** Called with the full roll result after animation completes. */
  onResult?: (result: {
    roll: number;
    total: number;
    dc: number;
    success: boolean;
    modifiers: { source: string; type: string; value: number }[];
  }) => void;
  /** Optional className for outer wrapper. */
  className?: string;
}

/**
 * Self-contained dice roll button that triggers a tRPC `dice.roll`
 * mutation and shows the animated DiceRoller.
 */
export function DiceRollButton({
  characterId,
  context,
  dc,
  onResult,
  className,
}: DiceRollButtonProps) {
  const { rolling, result, startRoll, deliverResult } = useDiceAnimation();

  const rollMutation = trpc.dice.roll.useMutation();

  const handleRoll = useCallback(async () => {
    if (rolling) return;

    startRoll();

    try {
      const data = await rollMutation.mutateAsync({
        characterId,
        context,
        dc,
      });

      // Deliver the raw d20 value to the animation.
      deliverResult(data.roll);

      // Notify parent after a short delay so animation can finish.
      // The onRollComplete callback in DiceRoller fires at the right time,
      // but we also pass data up here for convenience.
      onResult?.(data);
    } catch {
      // On error, stop rolling and show a fallback.
      deliverResult(0);
    }
  }, [
    rolling,
    startRoll,
    rollMutation,
    characterId,
    context,
    dc,
    deliverResult,
    onResult,
  ]);

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <DiceRoller result={result} rolling={rolling} />

      <Button
        onClick={handleRoll}
        disabled={rolling || rollMutation.isPending}
        size="lg"
        className="gap-2"
      >
        <Dices className="size-5" />
        {rolling ? "Rolling\u2026" : "Roll d20"}
      </Button>

      {rollMutation.isError && (
        <p className="text-sm text-destructive">
          Roll failed. Please try again.
        </p>
      )}
    </div>
  );
}
