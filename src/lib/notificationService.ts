import { Order, User } from './types';
import emailService from './emailService';
import smsService from './smsService';
import pushNotificationService from './pushNotificationService';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'all';

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
}

/**
 * Get user notification preferences from database
 */
const getUserNotificationPreferences = async (userId: string): Promise<NotificationPreferences> => {
  try {
    const admin = await import('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    const doc = await admin.firestore().collection('users').doc(userId).get();
    if (doc.exists) {
      return doc.data()?.notificationPreferences || {
        email: true,
        sms: true,
        push: true,
      };
    }
  } catch (error) {
    console.error('Error getting notification preferences:', error);
  }

  // Default preferences
  return {
    email: true,
    sms: true,
    push: true,
  };
};

/**
 * Send order confirmation through multiple channels
 */
export const sendOrderConfirmationNotification = async (
  order: Order & { 
    customerEmail?: string; 
    customerName?: string; 
    customerPhone?: string;
    userId?: string;
  }
): Promise<{ email: boolean; sms: boolean; push: boolean }> => {
  const results = { email: false, sms: false, push: false };

  try {
    // Email notification
    if (order.customerEmail) {
      results.email = await emailService.sendOrderConfirmation(order);
    }

    // SMS notification
    if (order.customerPhone) {
      results.sms = await smsService.sendOrderConfirmationSMS(order);
    }

    // Push notification
    if (order.userId) {
      results.push = await pushNotificationService.sendOrderConfirmationPush(order.userId, order);
    }
  } catch (error) {
    console.error('Error sending order confirmation notifications:', error);
  }

  return results;
};

/**
 * Send shipping notification through multiple channels
 */
export const sendShippingNotification = async (
  order: Order & {
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    userId?: string;
  }
): Promise<{ email: boolean; sms: boolean; push: boolean }> => {
  const results = { email: false, sms: false, push: false };

  try {
    if (order.customerEmail) {
      results.email = await emailService.sendShippingNotification(order);
    }

    if (order.customerPhone) {
      results.sms = await smsService.sendShippingSMS(order);
    }

    if (order.userId) {
      results.push = await pushNotificationService.sendShippingPush(order.userId, order);
    }
  } catch (error) {
    console.error('Error sending shipping notifications:', error);
  }

  return results;
};

/**
 * Send order delivered notification through multiple channels
 */
export const sendOrderDeliveredNotification = async (
  order: Order & {
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    userId?: string;
  }
): Promise<{ email: boolean; sms: boolean; push: boolean }> => {
  const results = { email: false, sms: false, push: false };

  try {
    if (order.customerEmail) {
      results.email = await emailService.sendOrderDelivered(order);
    }

    if (order.customerPhone) {
      results.sms = await smsService.sendDeliveryConfirmationSMS(order);
    }

    if (order.userId) {
      results.push = await pushNotificationService.sendOrderDeliveredPush(order.userId, order);
    }
  } catch (error) {
    console.error('Error sending order delivered notifications:', error);
  }

  return results;
};

/**
 * Send password reset email
 */
export const sendPasswordResetNotification = async (
  email: string,
  resetToken: string
): Promise<boolean> => {
  return emailService.sendPasswordReset(email, resetToken);
};

/**
 * Send OTP via SMS
 */
export const sendOTPNotification = async (
  phone: string,
  otp: string
): Promise<boolean> => {
  return smsService.sendOTPSMS(phone, otp);
};

/**
 * Send welcome notification
 */
export const sendWelcomeNotification = async (
  user: User & { email: string; displayName?: string; userId?: string }
): Promise<{ email: boolean; push: boolean }> => {
  const results = { email: false, push: false };

  try {
    results.email = await emailService.sendWelcomeEmail(user);

    if (user.userId) {
      results.push = await pushNotificationService.sendPushNotification(
        user.userId,
        'Selamat Datang! 👋',
        `Halo ${user.displayName || 'Pelanggan'}, terima kasih telah bergabung dengan AtayaToko!`,
        { type: 'WELCOME', url: '/products' }
      );
    }
  } catch (error) {
    console.error('Error sending welcome notifications:', error);
  }

  return results;
};

/**
 * Send payment reminder
 */
export const sendPaymentReminderNotification = async (
  order: Order & {
    customerEmail?: string;
    customerPhone?: string;
    userId?: string;
  }
): Promise<{ email: boolean; sms: boolean; push: boolean }> => {
  const results = { email: false, sms: false, push: false };

  try {
    if (order.customerPhone) {
      results.sms = await smsService.sendPaymentReminderSMS(order);
    }

    if (order.userId) {
      results.push = await pushNotificationService.sendPaymentReminderPush(order.userId, order);
    }
  } catch (error) {
    console.error('Error sending payment reminder notifications:', error);
  }

  return results;
};

/**
 * Send promotional notification to user
 */
export const sendPromotionalNotification = async (
  userId: string,
  title: string,
  message: string,
  imageUrl?: string
): Promise<{ push: boolean }> => {
  const results = { push: false };

  try {
    results.push = await pushNotificationService.sendPromotionalPush(
      userId,
      title,
      message,
      imageUrl
    );
  } catch (error) {
    console.error('Error sending promotional notification:', error);
  }

  return results;
};

/**
 * Update user notification preferences
 */
export const updateNotificationPreferences = async (
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> => {
  try {
    const admin = await import('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    await admin.firestore().collection('users').doc(userId).update({
      notificationPreferences: preferences,
    });

    console.log('Notification preferences updated for user:', userId);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
  }
};

export default {
  sendOrderConfirmationNotification,
  sendShippingNotification,
  sendOrderDeliveredNotification,
  sendPasswordResetNotification,
  sendOTPNotification,
  sendWelcomeNotification,
  sendPaymentReminderNotification,
  sendPromotionalNotification,
  updateNotificationPreferences,
};
