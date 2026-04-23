# Sistem Notifikasi & Chat - Dokumentasi Lengkap

## 📋 **Overview**

Sistem notifikasi multi-channel yang terintegrasi dengan real-time chat support untuk memberikan pengalaman komunikasi terbaik kepada pelanggan dan admin.

---

## 🎯 **Fitur yang Tersedia**

### ✅ **1. Email Notifications**
- Order confirmation
- Password reset
- Shipping notifications
- Order delivered
- Welcome email
- Payment reminders

### ✅ **2. SMS Notifications**
- Order confirmation
- Shipping updates
- OTP verification
- Payment reminders
- Delivery confirmation
- Promotional messages

### ✅ **3. Push Notifications (FCM)**
- Order confirmations
- Shipping updates
- Order delivered
- Payment reminders
- Promotional campaigns
- Chat message notifications
- Topic-based broadcasts

### ✅ **4. Real-time Chat Support**
- Customer-to-admin chat
- Admin response interface
- Image sharing (coming soon)
- Real-time messaging
- Browser notifications
- Sound alerts
- Unread message tracking

---

## 🏗️ **Arsitektur Sistem**

```
┌─────────────────────────────────────────────┐
│         Notification Services Layer          │
├──────────────┬──────────────┬───────────────┤
│   Email      │    SMS       │  Push (FCM)   │
│  (Nodemailer)│  (Twilio)    │ (Firebase)    │
└──────────────┴──────────────┴───────────────┘
              ↓
┌─────────────────────────────────────────────┐
│      Unified Notification Service           │
│  (notificationService.ts)                   │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│         Application Layer                    │
│  - Orders                                   │
│  - Users                                    │
│  - Products                                 │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│      Real-time Chat System                  │
│  - CustomerChat Component                   │
│  - AdminChatInterface                       │
│  - FloatingChatButton                       │
└─────────────────────────────────────────────┘
```

---

## 📦 **Dependencies**

### **Installed Packages:**
```json
{
  "nodemailer": "^6.10.1",        // Email service
  "twilio": "^5.11.2",            // SMS service
  "firebase-admin": "^13.6.1"     // FCM & Firestore
}
```

### **Environment Variables Required:**

```bash
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=noreply@atayatoko.com

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# App URL
NEXT_PUBLIC_APP_URL=https://atayatoko.aty0.com
```

---

## 🔧 **Setup & Configuration**

### **1. Email Setup (Gmail Example)**

1. **Enable 2-Factor Authentication** di Google Account
2. **Generate App Password:**
   - Kunjungi: https://myaccount.google.com/apppasswords
   - Pilih "Mail" dan device Anda
   - Copy password yang digenerate

3. **Update .env.local:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop  # App password (tanpa spasi)
SMTP_FROM_EMAIL=noreply@atayatoko.com
```

### **2. SMS Setup (Twilio)**

1. **Daftar di Twilio:** https://www.twilio.com/
2. **Beli Phone Number** di Twilio Console
3. **Get Credentials:**
   - Account SID
   - Auth Token
   - Phone Number

4. **Update .env.local:**
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### **3. Firebase Cloud Messaging Setup**

1. **Generate Service Account Key:**
   - Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download JSON file

2. **Extract credentials ke .env.local:**
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

**Note:** Pastikan private key dalam satu baris dengan `\n` untuk line breaks.

---

## 💻 **Usage Examples**

### **Email Notifications**

```typescript
import { sendOrderConfirmation, sendPasswordReset } from '@/lib/emailService';

// Send order confirmation
await sendOrderConfirmation({
  id: 'ORDER123',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  total: 150000,
  items: [...],
  paymentStatus: 'LUNAS',
  createdAt: new Date()
});

// Send password reset
await sendPasswordReset('user@example.com', 'reset-token-xyz');
```

### **SMS Notifications**

```typescript
import { sendOrderConfirmationSMS, sendOTPSMS } from '@/lib/smsService';

// Send order confirmation SMS
await sendOrderConfirmationSMS({
  id: 'ORDER123',
  customerPhone: '+6281234567890',
  total: 150000,
  paymentStatus: 'LUNAS'
});

// Send OTP
await sendOTPSMS('+6281234567890', '123456');
```

### **Push Notifications**

```typescript
import { 
  sendOrderConfirmationPush,
  saveFCMToken,
  sendToTopic 
} from '@/lib/pushNotificationService';

// Save user FCM token (client-side)
await saveFCMToken(userId, fcmToken);

// Send order confirmation push
await sendOrderConfirmationPush(userId, order);

// Broadcast to topic
await sendToTopic('promotions', 'Promo Spesial!', 'Diskon 50% hari ini!');
```

### **Unified Notification Service**

```typescript
import notificationService from '@/lib/notificationService';

// Send through all channels (email + SMS + push)
const results = await notificationService.sendOrderConfirmationNotification({
  id: 'ORDER123',
  userId: 'user-uid',
  customerEmail: 'customer@example.com',
  customerPhone: '+6281234567890',
  customerName: 'John Doe',
  total: 150000,
  items: [...],
  paymentStatus: 'LUNAS'
});

console.log(results);
// { email: true, sms: true, push: true }
```

### **Chat Integration**

```typescript
// Customer sends message (automatic via CustomerChat component)
// Admin receives real-time update with browser notification

// Admin replies (via AdminChatInterface)
// Customer receives instant message + optional push notification
```

---

## 📱 **Customer Chat Features**

### **Floating Chat Button**
- Selalu terlihat di bottom-right corner
- Badge notification untuk unread messages
- Tooltip hover dengan CTA text
- Smooth animations

### **Chat Modal**
- Responsive design (mobile & desktop)
- Real-time messaging
- Image upload support (coming soon)
- Message timestamps
- Auto-scroll to latest message
- Typing indicators (future enhancement)

### **Admin Chat Interface**
- Multi-thread management
- Search conversations
- Unread message indicators
- Real-time updates
- Browser notifications
- Sound alerts
- Mark as read functionality

---

## 🔔 **Notification Triggers**

### **Automatic Triggers:**

| Event | Email | SMS | Push |
|-------|-------|-----|------|
| Order Created | ✅ | ✅ | ✅ |
| Order Shipped | ✅ | ✅ | ✅ |
| Order Delivered | ✅ | ✅ | ✅ |
| Payment Reminder | ❌ | ✅ | ✅ |
| Password Reset | ✅ | ❌ | ❌ |
| New Chat Message | ❌ | ❌ | ✅ |
| Welcome | ✅ | ❌ | ✅ |

### **Manual Triggers:**

```typescript
// Send promotional campaign
await notificationService.sendPromotionalNotification(
  userId,
  'Flash Sale! ⚡',
  'Diskon 70% untuk semua produk elektronik!',
  'https://example.com/promo-image.jpg'
);

// Send OTP
await notificationService.sendOTPNotification('+6281234567890', '654321');
```

---

## 🛠️ **API Endpoints**

### **Save FCM Token**
```typescript
POST /api/fcm/token
Body: { token: string, platform: 'web' | 'ios' | 'android' }
```

### **Send Test Notification**
```typescript
POST /api/notifications/test
Body: { 
  userId: string,
  type: 'email' | 'sms' | 'push',
  message: string
}
```

### **Update Notification Preferences**
```typescript
PUT /api/users/:userId/preferences
Body: {
  email: boolean,
  sms: boolean,
  push: boolean
}
```

---

## 📊 **Database Schema**

### **Collection: `chats`**
```typescript
{
  id: string,
  userId: string,
  userInfo: {
    name: string,
    email: string,
    photoURL?: string
  },
  lastMessage: string,
  lastMessageTime: Timestamp,
  isReadByAdmin: boolean,
  unreadCount: number,
  createdAt: Timestamp
}
```

### **Subcollection: `chats/{chatId}/messages`**
```typescript
{
  id: string,
  text: string,
  senderId: string,  // 'admin' or userId
  createdAt: Timestamp,
  isRead: boolean,
  type: 'text' | 'image',
  imageUrl?: string
}
```

### **Collection: `user_tokens`**
```typescript
{
  userId: string,
  fcmToken: string,
  platform: 'web' | 'ios' | 'android',
  updatedAt: Timestamp
}
```

### **Collection: `users`**
```typescript
{
  // ... other fields
  notificationPreferences: {
    email: boolean,
    sms: boolean,
    push: boolean
  }
}
```

---

## 🔒 **Security Considerations**

### **Environment Variables Protection**
- Jangan commit `.env.local` ke repository
- Gunakan `.env.example` sebagai template
- Rotate credentials secara berkala

### **Rate Limiting**
Implement rate limiting untuk mencegah abuse:
```typescript
// Example: Max 10 SMS per hour per user
const rateLimitKey = `sms_rate:${userId}`;
const count = await redis.get(rateLimitKey);
if (count && parseInt(count) > 10) {
  throw new Error('Rate limit exceeded');
}
```

### **Input Validation**
- Validate phone numbers sebelum kirim SMS
- Sanitize email content untuk prevent XSS
- Verify user ownership sebelum kirim notifikasi

### **Sensitive Data**
- Jangan include sensitive data di notification payload
- Use secure channels untuk password reset tokens
- Encrypt PII (Personally Identifiable Information)

---

## 🧪 **Testing**

### **Test Email Sending**
```bash
# Install nodemon for testing
npm install -g nodemon

# Create test script
node scripts/test-email.js
```

### **Test SMS Sending**
```bash
node scripts/test-sms.js
```

### **Test Push Notifications**
```bash
# Use Firebase Console
Firebase Console → Cloud Messaging → Send your first message

# Or use API
curl -X POST \
  https://fcm.googleapis.com/v1/projects/YOUR_PROJECT_ID/messages:send \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "token": "USER_FCM_TOKEN",
      "notification": {
        "title": "Test",
        "body": "This is a test notification"
      }
    }
  }'
```

---

## 📈 **Monitoring & Analytics**

### **Track Notification Delivery**
```typescript
// Log successful deliveries
await addDoc(collection(db, 'notification_logs'), {
  type: 'email',
  recipient: 'user@example.com',
  status: 'sent',
  messageId: result.messageId,
  timestamp: serverTimestamp()
});

// Track failures
await addDoc(collection(db, 'notification_logs'), {
  type: 'sms',
  recipient: '+6281234567890',
  status: 'failed',
  error: error.message,
  timestamp: serverTimestamp()
});
```

### **Dashboard Metrics**
- Total notifications sent (by type)
- Delivery success rate
- Average delivery time
- Failed notifications breakdown
- User engagement rates

---

## 🚀 **Best Practices**

### **Email**
1. ✅ Use HTML templates yang responsive
2. ✅ Include plain text fallback
3. ✅ Test di berbagai email clients
4. ✅ Use proper SPF/DKIM records
5. ❌ Jangan send bulk emails tanpa throttling

### **SMS**
1. ✅ Keep messages concise (< 160 chars)
2. ✅ Include opt-out instructions
3. ✅ Respect quiet hours (no SMS 10PM-7AM)
4. ✅ Validate phone numbers
5. ❌ Jangan spam users

### **Push Notifications**
1. ✅ Request permission at right moment
2. ✅ Provide value in each notification
3. ✅ Allow users to customize preferences
4. ✅ Handle token refresh
5. ❌ Jangan over-notify

### **Chat**
1. ✅ Set expectations for response time
2. ✅ Use auto-replies for common questions
3. ✅ Implement typing indicators
4. ✅ Save chat history
5. ❌ Jangan leave messages unanswered

---

## 🐛 **Troubleshooting**

### **Email Not Sending**
```bash
# Check SMTP connection
telnet smtp.gmail.com 587

# Verify credentials
echo $SMTP_USER
echo $SMTP_PASS
```

**Common Issues:**
- App password incorrect → Regenerate di Google Account
- Port blocked by firewall → Try port 465 with SSL
- Rate limited → Wait and retry with exponential backoff

### **SMS Not Sending**
```bash
# Check Twilio balance
curl -X GET https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Balance.json \
  -u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

**Common Issues:**
- Insufficient balance → Top up Twilio account
- Invalid phone number → Format dengan country code
- Trial account restrictions → Upgrade to paid

### **Push Notifications Not Working**
```bash
# Check FCM token validity
# Look for errors in browser console
# Verify service worker registration
```

**Common Issues:**
- Token expired → Refresh token on client
- Permission denied → Request permission again
- Service worker not registered → Check `/firebase-messaging-sw.js`

### **Chat Not Real-time**
```bash
# Check Firestore security rules
# Verify network connection
# Check browser console for errors
```

**Common Issues:**
- Security rules blocking reads → Update rules
- Network issues → Implement reconnection logic
- Missing indexes → Create required indexes

---

## 📚 **Additional Resources**

- [Nodemailer Documentation](https://nodemailer.com/)
- [Twilio SMS API](https://www.twilio.com/docs/sms/api)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Best Practices](https://web.dev/push-notifications-overview/)

---

## 🔄 **Future Enhancements**

- [ ] WhatsApp Business API integration
- [ ] In-app notification center
- [ ] Scheduled notifications
- [ ] A/B testing for notification content
- [ ] Advanced segmentation for targeted campaigns
- [ ] Rich media support (videos, carousels)
- [ ] AI-powered chatbot integration
- [ ] Sentiment analysis for chat messages
- [ ] Automated responses based on keywords

---

## 👥 **Support**

Untuk pertanyaan atau issue terkait sistem notifikasi & chat:
1. Check dokumentasi ini terlebih dahulu
2. Review error logs di browser console
3. Check notification logs di Firestore
4. Contact development team

---

**Last Updated:** 2026-04-24  
**Version:** 1.0.0  
**Maintained by:** ATAYATOKO Development Team
