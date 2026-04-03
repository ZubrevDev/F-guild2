"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function GuildsPage() {
  const t = useTranslations("guilds");
  const router = useRouter();
  const { update } = useSession();

  const { data: guilds, isLoading } = trpc.guild.myGuilds.useQuery();

  const [guildName, setGuildName] = useState("");
  const [guildDescription, setGuildDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const createMutation = trpc.guild.create.useMutation({
    onSuccess: async (guild) => {
      await update({ guildId: guild.id });
      router.push("/dashboard");
    },
    onError: (err) => {
      setCreateError(err.message);
    },
  });

  const joinMutation = trpc.guild.joinByInviteCode.useMutation({
    onSuccess: async (guild) => {
      await update({ guildId: guild.id });
      router.push("/dashboard");
    },
    onError: (err) => {
      setJoinError(err.message);
    },
  });

  // Auto-select when exactly one guild
  useEffect(() => {
    if (guilds && guilds.length === 1) {
      setIsRedirecting(true);
      update({ guildId: guilds[0].id }).then(() => {
        router.push("/dashboard");
      });
    }
  }, [guilds, update, router]);

  if (isLoading || isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // 0 guilds: show create + join cards
  if (guilds && guilds.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold">{t("noGuilds")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("noGuildsDesc")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Create Guild Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t("createGuild")}</CardTitle>
                <CardDescription>{t("guildName")}</CardDescription>
              </CardHeader>
              <CardContent>
                {createError && (
                  <p className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                    {createError}
                  </p>
                )}
                <div className="space-y-3">
                  <div>
                    <label htmlFor="guild-name" className="block text-sm font-medium">
                      {t("guildName")}
                    </label>
                    <input
                      id="guild-name"
                      type="text"
                      required
                      value={guildName}
                      onChange={(e) => setGuildName(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="guild-description" className="block text-sm font-medium">
                      {t("guildDescription")}
                    </label>
                    <input
                      id="guild-description"
                      type="text"
                      value={guildDescription}
                      onChange={(e) => setGuildDescription(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={createMutation.isPending || !guildName.trim()}
                    onClick={() => {
                      setCreateError("");
                      createMutation.mutate({ name: guildName.trim() });
                    }}
                  >
                    {createMutation.isPending ? "..." : t("create")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Join Guild Card */}
            <Card>
              <CardHeader>
                <CardTitle>{t("joinGuild")}</CardTitle>
                <CardDescription>{t("inviteCode")}</CardDescription>
              </CardHeader>
              <CardContent>
                {joinError && (
                  <p className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                    {joinError}
                  </p>
                )}
                <div className="space-y-3">
                  <div>
                    <label htmlFor="invite-code" className="block text-sm font-medium">
                      {t("inviteCode")}
                    </label>
                    <input
                      id="invite-code"
                      type="text"
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={joinMutation.isPending || !inviteCode.trim()}
                    onClick={() => {
                      setJoinError("");
                      joinMutation.mutate({ inviteCode: inviteCode.trim() });
                    }}
                  >
                    {joinMutation.isPending ? "..." : t("join")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // 2+ guilds: show selection grid
  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold">{t("selectGuild")}</h1>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guilds?.map((guild) => (
            <Card
              key={guild.id}
              className="cursor-pointer transition-colors hover:border-primary"
              onClick={async () => {
                setIsRedirecting(true);
                await update({ guildId: guild.id });
                router.push("/dashboard");
              }}
            >
              <CardHeader>
                <CardTitle>{guild.name}</CardTitle>
                <CardDescription>
                  {t("created", {
                    date: new Date(guild.createdAt).toLocaleDateString(),
                  })}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Join with invite code section */}
        <div className="mt-8">
          <p className="mb-3 text-sm text-muted-foreground">{t("orJoinExisting")}</p>
          {joinError && (
            <p className="mb-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {joinError}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t("inviteCode")}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              disabled={joinMutation.isPending || !inviteCode.trim()}
              onClick={() => {
                setJoinError("");
                joinMutation.mutate({ inviteCode: inviteCode.trim() });
              }}
            >
              {joinMutation.isPending ? "..." : t("join")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
