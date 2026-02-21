import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import app, { db, auth } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

export const requestForToken = async (force = false) => {
  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const messaging = getMessaging(app);
      
      // Check current permission
      if (Notification.permission === 'default' && !force) {
        console.log('Notification permission is default. Waiting for user gesture.');
        return null;
      }

      if (Notification.permission === 'denied') {
        console.warn('Notification permission denied.');
        return null;
      }

      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Ganti string kosong dengan VAPID Key dari Firebase Console -> Project Settings -> Cloud Messaging
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'YOUR_VAPID_KEY_HERE';
        
        if (vapidKey === 'YOUR_VAPID_KEY_HERE') {
            console.warn('VAPID Key belum diset di .env.local (NEXT_PUBLIC_FIREBASE_VAPID_KEY)');
            return null;
        }

        const currentToken = await getToken(messaging, { 
          vapidKey: vapidKey
        });
        
        if (currentToken) {
          console.log('FCM Token:', currentToken);
          // Save token to user profile if logged in
          if (auth.currentUser) {
              await setDoc(doc(db, 'users', auth.currentUser.uid), {
                  fcmToken: currentToken,
                  updatedAt: new Date().toISOString()
              }, { merge: true });
          }
          return currentToken;
        } else {
          console.log('No registration token available.');
        }
      }
    }
  } catch (error) {
    console.error('An error occurred while retrieving token. ', error);
  }
  return null;
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        const messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
          resolve(payload);
        });
    }
  });
