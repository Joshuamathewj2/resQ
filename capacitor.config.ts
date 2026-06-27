import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.resq.app',
  appName: 'ResQ',
  webDir: 'dist',
  android: {
    backgroundColor: '#0a0a0a',
  },
  plugins: {
    Motion: {},
    Camera: {
      saveToGallery: false,
    },
    Geolocation: {
      requestPermissions: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#FF0000',
    },
  },
};

export default config;
