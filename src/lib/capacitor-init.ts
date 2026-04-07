import { Capacitor } from "@capacitor/core";

/**
 * Initialize native platform features (status bar, splash screen).
 * No-op on web — only runs inside Capacitor native shell.
 */
export async function initCapacitor(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const { StatusBar, Style } = await import("@capacitor/status-bar");
  const { SplashScreen } = await import("@capacitor/splash-screen");

  await StatusBar.setBackgroundColor({ color: "#2d1b69" });
  await StatusBar.setStyle({ style: Style.Dark });
  await SplashScreen.hide();
}
