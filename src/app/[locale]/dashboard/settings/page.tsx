"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useSession } from "next-auth/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const localeNames: Record<string, string> = {
  en: "English",
  ru: "Русский",
  fr: "Français",
};

type Theme = "dark" | "light" | "system";

type NotifKey = "questCompleted" | "levelUp" | "prayerReceived" | "buffApplied";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(prefersDark ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  const guildId = session?.user?.guildId;
  const isMaster = session?.user?.role === "master";

  // --- Profile state ---
  const [profileName, setProfileName] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // --- Theme state ---
  const [theme, setTheme] = useState<Theme>("system");

  // --- Guild state ---
  const [guildName, setGuildName] = useState("");
  const [guildDescription, setGuildDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(50);
  const [xpModifier, setXpModifier] = useState(1);
  const [prayersEnabled, setPrayersEnabled] = useState(true);
  const [shopEnabled, setShopEnabled] = useState(true);
  const [diceRollsEnabled, setDiceRollsEnabled] = useState(true);
  const [guildSaved, setGuildSaved] = useState(false);
  const [codeRegenerated, setCodeRegenerated] = useState(false);

  // --- Notification state ---
  const [notifQuestCompleted, setNotifQuestCompleted] = useState(true);
  const [notifLevelUp, setNotifLevelUp] = useState(true);
  const [notifPrayerReceived, setNotifPrayerReceived] = useState(true);
  const [notifBuffApplied, setNotifBuffApplied] = useState(true);
  const [notifSaved, setNotifSaved] = useState(false);

  // --- Delete account state ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch user settings
  const { data: userSettings } = trpc.settings.getSettings.useQuery(undefined);

  // Fetch guild settings (masters only)
  const { data: guildSettings } = trpc.guild.getSettings.useQuery(
    { guildId: guildId! },
    { enabled: !!guildId && isMaster }
  );

  // Sync user settings when data arrives
  useEffect(() => {
    if (!userSettings) return;
    if (userSettings.name) setProfileName(userSettings.name);
    if (userSettings.theme) setTheme(userSettings.theme as Theme);
    const prefs = userSettings.notificationPreferences as Record<string, Record<string, boolean>> | null;
    if (prefs?.inApp) {
      if (typeof prefs.inApp.questCompleted === "boolean") setNotifQuestCompleted(prefs.inApp.questCompleted);
      if (typeof prefs.inApp.levelUp === "boolean") setNotifLevelUp(prefs.inApp.levelUp);
      if (typeof prefs.inApp.prayerReceived === "boolean") setNotifPrayerReceived(prefs.inApp.prayerReceived);
    }
  }, [userSettings]);

  // Sync guild settings when data arrives
  useEffect(() => {
    if (!guildSettings) return;
    setGuildName(guildSettings.name ?? "");
    setGuildDescription(guildSettings.description ?? "");
    setInviteCode(guildSettings.inviteCode ?? "");
    setMaxPlayers(guildSettings.maxPlayers ?? 50);
    setXpModifier(guildSettings.xpModifier ?? 1);
    setPrayersEnabled(guildSettings.features?.prayersEnabled ?? true);
    setShopEnabled(guildSettings.features?.shopEnabled ?? true);
    setDiceRollsEnabled(guildSettings.features?.diceRollsEnabled ?? true);
  }, [guildSettings]);

  // Mutations
  const updateProfile = trpc.settings.updateProfile.useMutation();
  const updateTheme = trpc.settings.updateTheme.useMutation();
  const updateGuildSettings = trpc.guild.updateSettings.useMutation();
  const regenerateInviteCode = trpc.guild.regenerateInviteCode.useMutation();
  const updateNotifications = trpc.settings.updateNotificationPreferences.useMutation();
  const exportData = trpc.auth.exportData.useQuery(undefined, { enabled: false });
  const deleteAccount = trpc.auth.deleteAccount.useMutation();

  function changeLocale(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  async function handleSaveProfile() {
    await updateProfile.mutateAsync({ name: profileName });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  }

  async function handleSaveTheme(newTheme: Theme) {
    setTheme(newTheme);
    applyTheme(newTheme);
    await updateTheme.mutateAsync({ theme: newTheme });
  }

  async function handleSaveGuild() {
    if (!guildId) return;
    await updateGuildSettings.mutateAsync({
      guildId,
      name: guildName,
      description: guildDescription,
      settings: {
        maxPlayers,
        xpModifier,
        features: {
          prayersEnabled,
          shopEnabled,
          diceRollsEnabled,
        },
      },
    });
    setGuildSaved(true);
    setTimeout(() => setGuildSaved(false), 3000);
  }

  async function handleRegenerateCode() {
    if (!guildId) return;
    const result = await regenerateInviteCode.mutateAsync({ guildId });
    setInviteCode(result.inviteCode ?? "");
    setCodeRegenerated(true);
    setTimeout(() => setCodeRegenerated(false), 3000);
  }

  async function handleSaveNotifications() {
    await updateNotifications.mutateAsync({
      inApp: {
        questCompleted: notifQuestCompleted,
        levelUp: notifLevelUp,
        prayerReceived: notifPrayerReceived,
      },
    });
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
  }

  async function handleExportData() {
    const result = await exportData.refetch();
    if (result.data) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-data.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleDeleteAccount() {
    await deleteAccount.mutateAsync();
    router.replace("/");
  }

  const themeOptions: { value: Theme; label: string }[] = [
    { value: "dark", label: t("themeDark") },
    { value: "light", label: t("themeLight") },
    { value: "system", label: t("themeSystem") },
  ];

  const notifToggles: { key: NotifKey; label: string; value: boolean; setter: (v: boolean) => void }[] = [
    { key: "questCompleted", label: t("notifQuestCompleted"), value: notifQuestCompleted, setter: setNotifQuestCompleted },
    { key: "levelUp", label: t("notifLevelUp"), value: notifLevelUp, setter: setNotifLevelUp },
    { key: "prayerReceived", label: t("notifPrayerReceived"), value: notifPrayerReceived, setter: setNotifPrayerReceived },
    { key: "buffApplied", label: t("notifBuffApplied"), value: notifBuffApplied, setter: setNotifBuffApplied },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* ── Profile ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Display Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="profileName">
              {t("profileName")}
            </label>
            <input
              id="profileName"
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-base md:text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Language */}
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("language")}</p>
            <div className="flex flex-col gap-2">
              {routing.locales.map((loc) => (
                <button
                  key={loc}
                  onClick={() => changeLocale(loc)}
                  className={`flex items-center gap-3 rounded-md px-4 py-3 text-left text-sm transition-colors ${
                    loc === locale
                      ? "bg-primary/10 text-primary font-medium ring-1 ring-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="text-lg">
                    {loc === "en" ? "🇬🇧" : loc === "ru" ? "🇷🇺" : "🇫🇷"}
                  </span>
                  <span>{localeNames[loc]}</span>
                  {loc === locale && (
                    <span className="ml-auto text-xs text-primary">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("theme")}</p>
            <div className="flex gap-2">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSaveTheme(opt.value)}
                  className={`flex-1 min-h-[44px] rounded-md px-3 py-2 text-sm transition-colors ${
                    theme === opt.value
                      ? "bg-primary text-primary-foreground font-medium"
                      : "border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={handleSaveProfile}
              disabled={updateProfile.isPending}
              size="sm"
            >
              {t("save")}
            </Button>
            {profileSaved && (
              <span className="text-sm text-xp">{t("saved")}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Guild Settings (masters only) ── */}
      {isMaster && guildId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("guild")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Guild name */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="guildName">
                {t("guildName")}
              </label>
              <input
                id="guildName"
                type="text"
                value={guildName}
                onChange={(e) => setGuildName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-base md:text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="guildDescription">
                {t("guildDescription")}
              </label>
              <textarea
                id="guildDescription"
                value={guildDescription}
                onChange={(e) => setGuildDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-base md:text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            {/* Invite code */}
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("inviteCode")}</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteCode}
                  className="flex-1 rounded-md border bg-muted px-3 py-2 text-base md:text-sm font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateCode}
                  disabled={regenerateInviteCode.isPending}
                >
                  {t("regenerateCode")}
                </Button>
              </div>
              {codeRegenerated && (
                <p className="text-sm text-xp">{t("codeRegenerated")}</p>
              )}
            </div>

            {/* Max players */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="maxPlayers">
                {t("maxPlayers")}
              </label>
              <input
                id="maxPlayers"
                type="number"
                min={1}
                max={100}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-base md:text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* XP modifier */}
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="xpModifier">
                {t("xpModifier")}
              </label>
              <input
                id="xpModifier"
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                value={xpModifier}
                onChange={(e) => setXpModifier(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-base md:text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Feature toggles */}
            <div className="space-y-2">
              {[
                { label: "Prayers", value: prayersEnabled, setter: setPrayersEnabled },
                { label: "Shop", value: shopEnabled, setter: setShopEnabled },
                { label: "Dice Rolls", value: diceRollsEnabled, setter: setDiceRollsEnabled },
              ].map((feat) => (
                <label key={feat.label} className="flex items-center gap-3 cursor-pointer select-none">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={feat.value}
                    onClick={() => feat.setter(!feat.value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      feat.value ? "bg-primary" : "bg-muted border"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        feat.value ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-sm">{feat.label}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={handleSaveGuild}
                disabled={updateGuildSettings.isPending}
                size="sm"
              >
                {t("save")}
              </Button>
              {guildSaved && (
                <span className="text-sm text-xp">{t("saved")}</span>
              )}
              {updateGuildSettings.isError && (
                <span className="text-sm text-destructive">
                  {updateGuildSettings.error.message}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Notification Preferences ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("notifications")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notifToggles.map((notif) => (
            <label key={notif.key} className="flex items-center justify-between cursor-pointer select-none">
              <span className="text-sm">{notif.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={notif.value}
                onClick={() => notif.setter(!notif.value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  notif.value ? "bg-primary" : "bg-muted border"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    notif.value ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          ))}

          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={handleSaveNotifications}
              disabled={updateNotifications.isPending}
              size="sm"
            >
              {t("save")}
            </Button>
            {notifSaved && (
              <span className="text-sm text-xp">{t("saved")}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Account (GDPR) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("account")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Export */}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              disabled={exportData.isFetching}
            >
              {t("exportData")}
            </Button>
          </div>

          {/* Delete */}
          {!showDeleteConfirm ? (
            <div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                {t("deleteAccount")}
              </Button>
            </div>
          ) : (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm text-destructive font-medium">{t("deleteConfirm")}</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleteAccount.isPending}
                >
                  {t("deleteButton")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
