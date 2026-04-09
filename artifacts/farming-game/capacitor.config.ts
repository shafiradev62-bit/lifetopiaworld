import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifetopia.pixelfarm',
  appName: 'LifetopiaWorld',
  webDir: 'dist',
  android: {
    backgroundColor: "#000000",
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  // Allow navigation to wallet universal links
  server: {
    allowNavigation: [
      "phantom.app",
      "solflare.com",
      "backpack.app",
      "metamask.app.link",
      "link.trustwallet.com",
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#000000",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
