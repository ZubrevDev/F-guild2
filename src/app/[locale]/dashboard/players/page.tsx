"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const AVATAR_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-green-500",
  "bg-teal-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type AuthMethod = "pin" | "qr" | "email";
type CharacterClass = "fighter" | "wizard" | "ranger" | "cleric" | "rogue" | "bard";

interface ResetPinState {
  playerId: string;
  value: string;
}

interface QrDialogState {
  playerId: string;
  playerName: string;
}

interface CreateCharDialogState {
  playerId: string;
  playerName: string;
}

const CLASS_DATA: { key: CharacterClass; emoji: string }[] = [
  { key: "fighter", emoji: "⚔️" },
  { key: "wizard", emoji: "🪄" },
  { key: "ranger", emoji: "🌲" },
  { key: "cleric", emoji: "✝️" },
  { key: "rogue", emoji: "👁️" },
  { key: "bard", emoji: "🎵" },
];

export default function PlayersPage() {
  const t = useTranslations("players");
  const tc = useTranslations("character");
  const { data: session } = useSession();
  const guildId = (session?.user as { guildId?: string } | undefined)?.guildId;

  // Add Player dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newAuthMethod, setNewAuthMethod] = useState<AuthMethod>("pin");
  const [addError, setAddError] = useState("");

  // QR dialog state
  const [qrDialog, setQrDialog] = useState<QrDialogState | null>(null);
  const [qrCopied, setQrCopied] = useState(false);

  // Reset PIN inline state
  const [resetPin, setResetPin] = useState<ResetPinState | null>(null);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  // Create Character dialog state
  const [createCharDialog, setCreateCharDialog] = useState<CreateCharDialogState | null>(null);
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [createCharError, setCreateCharError] = useState("");

  const utils = trpc.useUtils();

  const { data: players, isLoading } = trpc.player.list.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId }
  );

  const createMutation = trpc.player.create.useMutation({
    onSuccess: () => {
      utils.player.list.invalidate({ guildId: guildId! });
      setAddOpen(false);
      setNewName("");
      setNewPin("");
      setNewAuthMethod("pin");
      setAddError("");
    },
    onError: (err) => {
      setAddError(err.message);
    },
  });

  const resetPinMutation = trpc.player.resetPin.useMutation({
    onSuccess: () => {
      setResetPin(null);
      setResetError("");
      setResetSuccess(t("pinReset"));
      setTimeout(() => setResetSuccess(""), 3000);
    },
    onError: (err) => {
      setResetError(err.message);
    },
  });

  const createCharMutation = trpc.character.create.useMutation({
    onSuccess: () => {
      utils.player.list.invalidate({ guildId: guildId! });
      setCreateCharDialog(null);
      setSelectedClass(null);
      setCreateCharError("");
    },
    onError: (err) => {
      setCreateCharError(err.message);
    },
  });

  // QR code fetch — enabled only when a dialog is open
  const { data: qrData, isLoading: qrLoading } = trpc.player.getQrCode.useQuery(
    { playerId: qrDialog?.playerId ?? "" },
    { enabled: !!qrDialog?.playerId }
  );

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guildId) return;
    if (newName.length < 2 || newName.length > 50) {
      setAddError("Name must be 2–50 characters");
      return;
    }
    if (newAuthMethod === "pin" && !/^\d{4,6}$/.test(newPin)) {
      setAddError("PIN must be 4–6 digits");
      return;
    }
    createMutation.mutate({
      guildId,
      name: newName,
      authMethod: newAuthMethod,
      pin: newAuthMethod === "pin" ? newPin : undefined,
    });
  }

  function handleResetSubmit(playerId: string) {
    if (!resetPin || !/^\d{4,6}$/.test(resetPin.value)) {
      setResetError("PIN must be 4–6 digits");
      return;
    }
    resetPinMutation.mutate({ playerId, newPin: resetPin.value });
  }

  function handleCopyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    });
  }

  function handleCreateCharSubmit() {
    if (!createCharDialog || !selectedClass) return;
    createCharMutation.mutate({ playerId: createCharDialog.playerId, class: selectedClass });
  }

  function authMethodLabel(method: AuthMethod): string {
    if (method === "pin") return t("pinMethod");
    if (method === "qr") return t("qrMethod");
    return t("emailMethod");
  }

  function openCreateCharDialog(playerId: string, playerName: string) {
    setCreateCharDialog({ playerId, playerName });
    setSelectedClass(null);
    setCreateCharError("");
  }

  function closeCreateCharDialog() {
    setCreateCharDialog(null);
    setSelectedClass(null);
    setCreateCharError("");
  }

  if (!guildId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button onClick={() => setAddOpen(true)}>{t("addPlayer")}</Button>
      </div>

      {/* Success toast */}
      {resetSuccess && (
        <div className="rounded-md bg-green-100 px-4 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
          {resetSuccess}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && players && players.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 text-6xl" aria-hidden="true">
            ⚔️
          </div>
          <h2 className="mb-2 text-xl font-semibold">{t("noPlayers")}</h2>
          <p className="mb-6 text-sm text-muted-foreground">{t("noPlayersDesc")}</p>
          <Button onClick={() => setAddOpen(true)}>{t("addPlayer")}</Button>
        </div>
      )}

      {/* Player grid */}
      {!isLoading && players && players.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => {
            const avatarColor = getAvatarColor(player.name);
            const isResetting = resetPin?.playerId === player.id;

            return (
              <Card key={player.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-bold text-lg ${avatarColor}`}
                      aria-hidden="true"
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{player.name}</CardTitle>
                      <Badge variant="outline" className="mt-1 text-[10px] capitalize">
                        {authMethodLabel(player.authMethod as AuthMethod)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {/* Character info */}
                  {player.character ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{player.character.class}</span>
                        <span className="text-muted-foreground">
                          {t("level", { level: player.character.level })}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">
                        {t("noCharacter")}
                      </Badge>
                      <button
                        type="button"
                        className="text-xs text-primary underline underline-offset-2 hover:no-underline"
                        onClick={() => openCreateCharDialog(player.id, player.name)}
                      >
                        {t("createCharacter")}
                      </button>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        setQrDialog({ playerId: player.id, playerName: player.name })
                      }
                    >
                      {t("showQr")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setResetPin(isResetting ? null : { playerId: player.id, value: "" });
                        setResetError("");
                      }}
                    >
                      {t("resetPin")}
                    </Button>
                  </div>

                  {/* Inline Reset PIN */}
                  {isResetting && (
                    <div className="space-y-2 rounded-md border border-input p-3">
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="\d{4,6}"
                        maxLength={6}
                        placeholder="New PIN (4–6 digits)"
                        className={INPUT_CLASS}
                        value={resetPin?.value ?? ""}
                        onChange={(e) =>
                          setResetPin({ playerId: player.id, value: e.target.value })
                        }
                      />
                      {resetError && (
                        <p className="text-xs text-destructive">{resetError}</p>
                      )}
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={resetPinMutation.isPending}
                        onClick={() => handleResetSubmit(player.id)}
                      >
                        {resetPinMutation.isPending ? "…" : t("resetPin")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Player dialog */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{t("addPlayer")}</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-sm font-medium">{t("playerName")}</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={50}
                  className={INPUT_CLASS}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              {/* Auth method */}
              <div>
                <label className="text-sm font-medium">{t("authMethod")}</label>
                <select
                  className={INPUT_CLASS}
                  value={newAuthMethod}
                  onChange={(e) => setNewAuthMethod(e.target.value as AuthMethod)}
                >
                  <option value="pin">{t("pinMethod")}</option>
                  <option value="qr">{t("qrMethod")}</option>
                  <option value="email">{t("emailMethod")}</option>
                </select>
              </div>

              {/* PIN — only when method is pin */}
              {newAuthMethod === "pin" && (
                <div>
                  <label className="text-sm font-medium">{t("pin")}</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4,6}"
                    minLength={4}
                    maxLength={6}
                    required
                    className={INPUT_CLASS}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                  />
                </div>
              )}

              {addError && <p className="text-sm text-destructive">{addError}</p>}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setAddOpen(false);
                    setAddError("");
                    setNewName("");
                    setNewPin("");
                    setNewAuthMethod("pin");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "…" : t("addPlayer")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code dialog */}
      {qrDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setQrDialog(null);
              setQrCopied(false);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-lg bg-background p-6 shadow-xl">
            <h2 className="mb-4 text-center text-lg font-semibold">
              {t("showQr")} — {qrDialog.playerName}
            </h2>

            {qrLoading && (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            )}

            {qrData && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrData.qrDataUrl}
                    alt={`QR code for ${qrDialog.playerName}`}
                    width={280}
                    height={280}
                    className="rounded-md"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Login URL</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 truncate rounded-md border border-input bg-muted px-3 py-2 text-xs">
                      {qrData.loginUrl}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs"
                      onClick={() => handleCopyUrl(qrData.loginUrl)}
                    >
                      {qrCopied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Button
              className="mt-4 w-full"
              variant="outline"
              onClick={() => {
                setQrDialog(null);
                setQrCopied(false);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Create Character dialog */}
      {createCharDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCreateCharDialog();
          }}
        >
          <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold">{tc("selectClass")}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{createCharDialog.playerName}</p>

            {/* 6 class cards: 1 col mobile, 2 col sm, 3 col md */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {CLASS_DATA.map(({ key, emoji }) => {
                const isSelected = selectedClass === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedClass(key)}
                    className={[
                      "rounded-lg border p-3 text-left transition-colors",
                      "hover:border-primary hover:bg-primary/5",
                      isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary"
                        : "border-input bg-card",
                    ].join(" ")}
                  >
                    <div className="mb-1 text-2xl" aria-hidden="true">
                      {emoji}
                    </div>
                    <div className="text-sm font-semibold">{tc(key)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {tc(`${key}Desc` as Parameters<typeof tc>[0])}
                    </div>
                  </button>
                );
              })}
            </div>

            {createCharError && (
              <p className="mt-3 text-sm text-destructive">{createCharError}</p>
            )}

            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={closeCreateCharDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!selectedClass || createCharMutation.isPending}
                onClick={handleCreateCharSubmit}
              >
                {createCharMutation.isPending ? "…" : tc("create")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
