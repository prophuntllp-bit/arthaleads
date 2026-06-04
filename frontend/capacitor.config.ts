import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId:   "com.arthaleads.crm",
  appName: "Arthaleads",
  webDir:  "dist",

  // Load the live hosted website so web deployments update the app instantly
  // without needing a new APK release for content changes.
  server: {
    url:       "https://arthaleads.com",
    cleartext: false,
  },

  plugins: {
    PushNotifications: {
      // Show notification UI even when app is in the foreground
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
