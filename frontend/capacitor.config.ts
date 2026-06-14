import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId:   "com.arthaleads.crm",
  appName: "Arthaleads",
  webDir:  "dist",
  backgroundColor: "#111113",

  android: {
    backgroundColor: "#111113",
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "Dark",
      backgroundColor: "#111113",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
