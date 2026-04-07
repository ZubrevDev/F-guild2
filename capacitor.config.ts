import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fguild.app",
  appName: "F-Guild",
  webDir: "dist",
  server: {
    url: "https://f-guild.vercel.app",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#2d1b69",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#2d1b69",
    },
  },
};

export default config;
