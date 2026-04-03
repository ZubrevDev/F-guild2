"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { setPlayerSession } from "@/lib/player-session";

export default function PlayerLoginPage() {
  const t = useTranslations("playerLogin");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inviteCode, setInviteCode] = useState(searchParams.get("invite") ?? "");
  const [playerName, setPlayerName] = useState(searchParams.get("name") ?? "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.player.loginByPin.useMutation({
    onSuccess(data) {
      setPlayerSession({
        playerId: data.playerId,
        guildId: data.guildId,
        playerName: data.playerName,
      });
      router.push("/player");
    },
    onError() {
      setError(t("wrongCredentials"));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ inviteCode, playerName, pin });
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="inviteCode" className="block text-sm font-medium">
              {t("guildCode")}
            </label>
            <input
              id="inviteCode"
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="playerName" className="block text-sm font-medium">
              {t("playerName")}
            </label>
            <input
              id="playerName"
              type="text"
              required
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="pin" className="block text-sm font-medium">
              {t("pin")}
            </label>
            <input
              id="pin"
              type="password"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "..." : t("login")}
          </Button>
        </form>
      </div>
    </div>
  );
}
