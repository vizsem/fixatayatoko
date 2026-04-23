import twilio from 'twilio';
import { Order } from './types';

// Twilio configuration dari environment variables
const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER,
};

// Buat Twilio client (singleton pattern)
let twilioClient: ReturnType<typeof twilio> | null = null;

const getTwilioClient = () => {
  if (!twilioClient) {
    if (!TWILIO_CONFIG.accountSid || !TWILIO_CONFIG.authToken) {
      console.warn('Twilio credentials not configured. SMS notifications will be disabled.');
      return null;
    }
    twilioClient = twilio(TWILIO_CONFIG.accountSid, TWILIO_CONFIG.authToken);
  }
  return twilioClient;
};

/**
 * Send SMS dengan retry mechanism
 */
export const sendSMS = async (to: string, body: string): Promise<boolean> => {
  try {
    const client = getTwilioClient();
    if (!client) {
      console.warn('Twilio client not initialized. SMS not sent.');
      return false;
    }

    // Format nomor telepon (tambahkan country code jika belum ada)
    const formattedTo = to.startsWith('+') ? to : `+62${to.replace(/^0/, '')}`;

    const message = await client.messages.create({
      body,
      from: TWILIO_CONFIG.phoneNumber,
      to: formattedTo,
    });

    console.log('SMS sent successfully:', message.sid);
    return true;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return false;
  }
};

/**
 * Send order confirmation SMS
 */
export const sendOrderConfirmationSMS = async (order: Order & { customerPhone?: string }): Promise<boolean> => {
  if (!order.customerPhone) {
    console.warn('No customer phone provided for order:', order.id);
    return false;
  }

  const body = `Pesanan #${order.id} berhasil! Total: Rp ${order.total.toLocaleString('id-ID')}. Status: ${order.paymentStatus}. Terima kasih telah berbelanja di AtayaToko!`;

  return sendSMS(order.customerPhone, body);
};

/**
 * Send shipping notification SMS
 */
export const sendShippingSMS = async (order: Order & { customerPhone?: string }): Promise<boolean> => {
  if (!order.customerPhone) return false;

  const trackingInfo = order.trackingNumber ? `\nNo. Resi: ${order.trackingNumber}` : '';
  const body = `Pesanan #${order.id} sedang dikirim!${trackingInfo}\nEstimasi tiba: 2-3 hari kerja. Track: ${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}`;

  return sendSMS(order.customerPhone, body);
};

/**
 * Send OTP verification SMS
 */
export const sendOTPSMS = async (phone: string, otp: string): Promise<boolean> => {
  const body = `Kode OTP AtayaToko Anda: ${otp}\nJangan bagikan kode ini kepada siapapun.\nBerlaku selama 5 menit.`;

  return sendSMS(phone, body);
};

/**
 * Send payment reminder SMS
 */
export const sendPaymentReminderSMS = async (order: Order & { customerPhone?: string }): Promise<boolean> => {
  if (!order.customerPhone) return false;

  const body = `Reminder: Pesanan #${order.id} belum dibayar. Total: Rp ${order.total.toLocaleString('id-ID')}. Selesaikan pembayaran sebelum kadaluarsa. Bayar: ${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}`;

  return sendSMS(order.customerPhone, body);
};

/**
 * Send delivery confirmation SMS
 */
export const sendDeliveryConfirmationSMS = async (order: Order & { customerPhone?: string }): Promise<boolean> => {
  if (!order.customerPhone) return false;

  const body = `Pesanan #${order.id} telah diterima. Terima kasih! Jangan lupa beri review untuk produk yang Anda beli. Review: ${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}`;

  return sendSMS(order.customerPhone, body);
};

/**
 * Send promotional SMS
 */
export const sendPromotionalSMS = async (phone: string, promoMessage: string): Promise<boolean> => {
  const body = `🎉 Promo Spesial dari AtayaToko!\n\n${promoMessage}\n\nBelanja sekarang: ${process.env.NEXT_PUBLIC_APP_URL}\n\nUnsubscribe: Reply STOP`;

  return sendSMS(phone, body);
};

export default {
  sendSMS,
  sendOrderConfirmationSMS,
  sendShippingSMS,
  sendOTPSMS,
  sendPaymentReminderSMS,
  sendDeliveryConfirmationSMS,
  sendPromotionalSMS,
};
