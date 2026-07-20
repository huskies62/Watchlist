import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.personal.watchlist',
  appName: 'Watchlist',
  webDir: 'www',
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
