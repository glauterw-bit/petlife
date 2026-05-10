import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.petlife',
  appName: 'PetLife',
  // Como o app é um Next.js servido em produção pelo Railway, apontamos o WebView
  // para a URL remota — sem precisar exportar estaticamente o site.
  server: {
    url: 'https://petlife-frontend-production.up.railway.app',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [
      'petlife-frontend-production.up.railway.app',
      'petlife-backend-production.up.railway.app',
      '*.railway.app',
    ],
  },
  webDir: 'public',
  ios: {
    contentInset: 'always',
    backgroundColor: '#ffffff',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#10b981',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'DEFAULT',
      backgroundColor: '#ffffff',
    },
  },
}

export default config
