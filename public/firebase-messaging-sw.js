importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// ⚠️ PENTING: Ganti dengan konfigurasi Firebase Anda (bisa dilihat di src/lib/firebase.ts atau Firebase Console)
// Karena ini file statis, kita tidak bisa menggunakan process.env
const firebaseConfig = {
  apiKey: "ISI_API_KEY_DISINI",
  authDomain: "marketpleace-new.firebaseapp.com", // Sesuaikan dengan project ID
  projectId: "marketpleace-new", // Sesuaikan
  storageBucket: "marketpleace-new.appspot.com", // Sesuaikan
  messagingSenderId: "ISI_SENDER_ID_DISINI",
  appId: "ISI_APP_ID_DISINI"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/logo-atayatoko.png',
      badge: '/logo-atayatoko.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  console.error("Error initializing Firebase in SW:", e);
}
