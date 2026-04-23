import admin from 'firebase-admin';
import { Order } from './types';

// Initialize Firebase Admin jika belum
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

/**
 * Save user FCM token to database
 */
export const saveFCMToken = async (userId: string, token: string): Promise<void> => {
  try {
    await admin.firestore().collection('user_tokens').doc(userId).set(
      {
        fcmToken: token,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        platform: 'web', // atau 'ios', 'android'
      },
      { merge: true }
    );
    console.log('FCM token saved for user:', userId);
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
};

/**
 * Get user FCM token from database
 */
export const getUserFCMToken = async (userId: string): Promise<string | null> => {
  try {
    const doc = await admin.firestore().collection('user_tokens').doc(userId).get();
    if (doc.exists) {
      return doc.data()?.fcmToken || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Send push notification to specific user
 */
export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  imageUrl?: string
): Promise<boolean> => {
  try {
    const token = await getUserFCMToken(userId);
    if (!token) {
      console.warn('No FCM token found for user:', userId);
      return false;
    }

    const message: admin.messaging.Message = {
      token,
      notification: {
        title,
        body,
        ...(imageUrl && { imageUrl }),
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'orders',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Push notification sent successfully:', response);
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    
    // Handle invalid/expired tokens
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      // Remove invalid token from database
      await admin.firestore().collection('user_tokens').doc(userId).delete();
    }
    
    return false;
  }
};

/**
 * Send push notification to multiple users
 */
export const sendPushNotificationToMultipleUsers = async (
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: number; failed: number }> => {
  const results = { success: 0, failed: 0 };

  for (const userId of userIds) {
    const success = await sendPushNotification(userId, title, body, data);
    if (success) {
      results.success++;
    } else {
      results.failed++;
    }
  }

  return results;
};

/**
 * Send order confirmation push notification
 */
export const sendOrderConfirmationPush = async (
  userId: string,
  order: Order
): Promise<boolean> => {
  return sendPushNotification(
    userId,
    'Pesanan Berhasil! 🎉',
    `Pesanan #${order.id} telah diterima. Total: Rp ${order.total.toLocaleString('id-ID')}`,
    {
      type: 'ORDER_CONFIRMATION',
      orderId: order.id,
      url: `/orders/${order.id}`,
    }
  );
};

/**
 * Send shipping notification push
 */
export const sendShippingPush = async (
  userId: string,
  order: Order
): Promise<boolean> => {
  return sendPushNotification(
    userId,
    'Pesanan Sedang Dikirim! 🚚',
    `Pesanan #${order.id} sedang dalam perjalanan. ${order.trackingNumber ? `Resi: ${order.trackingNumber}` : ''}`,
    {
      type: 'SHIPPING_UPDATE',
      orderId: order.id,
      url: `/orders/${order.id}`,
    }
  );
};

/**
 * Send order delivered push
 */
export const sendOrderDeliveredPush = async (
  userId: string,
  order: Order
): Promise<boolean> => {
  return sendPushNotification(
    userId,
    'Pesanan Telah Diterima! ✅',
    `Pesanan #${order.id} telah tiba. Terima kasih telah berbelanja!`,
    {
      type: 'ORDER_DELIVERED',
      orderId: order.id,
      url: `/orders/${order.id}`,
    }
  );
};

/**
 * Send payment reminder push
 */
export const sendPaymentReminderPush = async (
  userId: string,
  order: Order
): Promise<boolean> => {
  return sendPushNotification(
    userId,
    'Reminder Pembayaran ⏰',
    `Pesanan #${order.id} belum dibayar. Selesaikan pembayaran sebelum kadaluarsa.`,
    {
      type: 'PAYMENT_REMINDER',
      orderId: order.id,
      url: `/orders/${order.id}`,
    }
  );
};

/**
 * Send promotional push notification
 */
export const sendPromotionalPush = async (
  userId: string,
  title: string,
  message: string,
  imageUrl?: string
): Promise<boolean> => {
  return sendPushNotification(
    userId,
    title,
    message,
    {
      type: 'PROMOTION',
      url: '/products',
    },
    imageUrl
  );
};

/**
 * Send chat message notification
 */
export const sendChatMessagePush = async (
  userId: string,
  senderName: string,
  messagePreview: string,
  chatId: string
): Promise<boolean> => {
  return sendPushNotification(
    userId,
    `Pesan baru dari ${senderName}`,
    messagePreview,
    {
      type: 'NEW_MESSAGE',
      chatId,
      url: `/admin/chat/${chatId}`,
    }
  );
};

/**
 * Subscribe user to topic
 */
export const subscribeToTopic = async (userId: string, topic: string): Promise<boolean> => {
  try {
    const token = await getUserFCMToken(userId);
    if (!token) return false;

    await admin.messaging().subscribeToTopic(token, topic);
    console.log(`User ${userId} subscribed to topic: ${topic}`);
    return true;
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    return false;
  }
};

/**
 * Unsubscribe user from topic
 */
export const unsubscribeFromTopic = async (userId: string, topic: string): Promise<boolean> => {
  try {
    const token = await getUserFCMToken(userId);
    if (!token) return false;

    await admin.messaging().unsubscribeFromTopic(token, topic);
    console.log(`User ${userId} unsubscribed from topic: ${topic}`);
    return true;
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    return false;
  }
};

/**
 * Send notification to topic
 */
export const sendToTopic = async (
  topic: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> => {
  try {
    const message: admin.messaging.Message = {
      topic,
      notification: {
        title,
        body,
      },
      data: data || {},
    };

    const response = await admin.messaging().send(message);
    console.log('Topic notification sent successfully:', response);
    return true;
  } catch (error) {
    console.error('Error sending topic notification:', error);
    return false;
  }
};

export default {
  saveFCMToken,
  getUserFCMToken,
  sendPushNotification,
  sendPushNotificationToMultipleUsers,
  sendOrderConfirmationPush,
  sendShippingPush,
  sendOrderDeliveredPush,
  sendPaymentReminderPush,
  sendPromotionalPush,
  sendChatMessagePush,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendToTopic,
};
