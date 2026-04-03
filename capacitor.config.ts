import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fguild.app",
  appName: "F-Guild",
  webDir: "dist",
  server: {
    url: "https://f-guild.example.com",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#110b20",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#110b20",
    },
  },
};

export default config;
