import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.binance.futuresbot',
  appName: 'Binance Bot',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
