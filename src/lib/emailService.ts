import nodemailer from 'nodemailer';
import { Order, User } from './types';

// Email configuration dari environment variables
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true untuk port 465, false untuk port lain
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Buat transporter (singleton pattern)
let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport(SMTP_CONFIG);
    
    // Verify connection configuration
    transporter.verify((error) => {
      if (error) {
        console.error('SMTP connection error:', error);
      } else {
        console.log('SMTP server is ready to send emails');
      }
    });
  }
  return transporter;
};

// Email template base
const createEmailTemplate = (content: string, title: string) => `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 2px solid #000000;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      color: #000000;
      font-size: 24px;
    }
    .content {
      padding: 20px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #000000;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #666;
      font-size: 12px;
    }
    .order-details {
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 6px;
      margin: 15px 0;
    }
    .order-item {
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .order-item:last-child {
      border-bottom: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AtayaToko</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Email ini dikirim secara otomatis, mohon tidak membalas email ini.</p>
      <p>&copy; ${new Date().getFullYear()} AtayaToko. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

// Interface untuk email options
interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

/**
 * Send email dengan retry mechanism
 */
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"AtayaToko" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    };

    const result = await getTransporter().sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
};

/**
 * Send order confirmation email
 */
export const sendOrderConfirmation = async (order: Order & { customerEmail?: string; customerName?: string }): Promise<boolean> => {
  if (!order.customerEmail) {
    console.warn('No customer email provided for order:', order.id);
    return false;
  }

  const orderItemsHtml = order.items.map(item => `
    <div class="order-item">
      <strong>${item.name}</strong><br/>
      Qty: ${item.quantity} x Rp ${item.price.toLocaleString('id-ID')}<br/>
      Subtotal: Rp ${(item.quantity * item.price).toLocaleString('id-ID')}
    </div>
  `).join('');

  const content = `
    <h2>Pesanan Berhasil! 🎉</h2>
    <p>Halo ${order.customerName || 'Pelanggan'},</p>
    <p>Terima kasih telah berbelanja di AtayaToko. Pesanan Anda telah kami terima dan sedang diproses.</p>
    
    <div class="order-details">
      <h3>Detail Pesanan</h3>
      <p><strong>Nomor Pesanan:</strong> #${order.id}</p>
      <p><strong>Tanggal:</strong> ${new Date(order.createdAt?.toDate() || Date.now()).toLocaleDateString('id-ID')}</p>
      <p><strong>Total:</strong> Rp ${order.total.toLocaleString('id-ID')}</p>
      <p><strong>Status Pembayaran:</strong> ${order.paymentStatus}</p>
      
      <h4>Item Pesanan:</h4>
      ${orderItemsHtml}
    </div>
    
    <p>Kami akan mengirimkan update selanjutnya ketika pesanan Anda siap dikirim.</p>
    
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}" class="button">Lihat Detail Pesanan</a>
    
    <p>Jika Anda memiliki pertanyaan, silakan hubungi customer service kami.</p>
  `;

  const html = createEmailTemplate(content, 'Konfirmasi Pesanan');

  return sendEmail({
    to: order.customerEmail,
    subject: `Konfirmasi Pesanan #${order.id} - AtayaToko`,
    html,
  });
};

/**
 * Send password reset email
 */
export const sendPasswordReset = async (email: string, resetToken: string): Promise<boolean> => {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;

  const content = `
    <h2>Reset Password 🔐</h2>
    <p>Halo,</p>
    <p>Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah untuk membuat password baru:</p>
    
    <a href="${resetUrl}" class="button">Reset Password</a>
    
    <p>Atau copy dan paste link berikut ke browser Anda:</p>
    <p style="word-break: break-all; color: #666;">${resetUrl}</p>
    
    <p><strong>Link ini akan kadaluarsa dalam 1 jam.</strong></p>
    
    <p>Jika Anda tidak meminta reset password, abaikan email ini. Password Anda akan tetap aman.</p>
  `;

  const html = createEmailTemplate(content, 'Reset Password');

  return sendEmail({
    to: email,
    subject: 'Reset Password - AtayaToko',
    html,
  });
};

/**
 * Send shipping notification email
 */
export const sendShippingNotification = async (order: Order & { customerEmail?: string; customerName?: string }): Promise<boolean> => {
  if (!order.customerEmail) return false;

  const content = `
    <h2>Pesanan Anda Sedang Dikirim! 🚚</h2>
    <p>Halo ${order.customerName || 'Pelanggan'},</p>
    <p>Kabar baik! Pesanan Anda telah dikirim dan sedang dalam perjalanan.</p>
    
    <div class="order-details">
      <p><strong>Nomor Pesanan:</strong> #${order.id}</p>
      <p><strong>No. Resi:</strong> ${order.trackingNumber || 'Sedang diproses'}</p>
      <p><strong>Kurir:</strong> ${order.shippingMethod || 'Reguler'}</p>
      <p><strong>Estimasi Tiba:</strong> ${order.estimatedDelivery ? new Date(order.estimatedDelivery.toDate()).toLocaleDateString('id-ID') : '2-3 hari kerja'}</p>
    </div>
    
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}" class="button">Track Pesanan</a>
  `;

  const html = createEmailTemplate(content, 'Pesanan Dikirim');

  return sendEmail({
    to: order.customerEmail,
    subject: `Pesanan #${order.id} Sedang Dikirim - AtayaToko`,
    html,
  });
};

/**
 * Send order delivered notification
 */
export const sendOrderDelivered = async (order: Order & { customerEmail?: string; customerName?: string }): Promise<boolean> => {
  if (!order.customerEmail) return false;

  const content = `
    <h2>Pesanan Telah Diterima! ✅</h2>
    <p>Halo ${order.customerName || 'Pelanggan'},</p>
    <p>Pesanan Anda telah tiba. Kami harap Anda puas dengan pembelian Anda.</p>
    
    <div class="order-details">
      <p><strong>Nomor Pesanan:</strong> #${order.id}</p>
      <p><strong>Total:</strong> Rp ${order.total.toLocaleString('id-ID')}</p>
    </div>
    
    <p>Jangan lupa berikan review untuk produk yang Anda beli!</p>
    
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}" class="button">Beri Review</a>
  `;

  const html = createEmailTemplate(content, 'Pesanan Diterima');

  return sendEmail({
    to: order.customerEmail,
    subject: `Pesanan #${order.id} Telah Diterima - AtayaToko`,
    html,
  });
};

/**
 * Send welcome email
 */
export const sendWelcomeEmail = async (user: User & { email: string; displayName?: string }): Promise<boolean> => {
  const content = `
    <h2>Selamat Datang di AtayaToko! 👋</h2>
    <p>Halo ${user.displayName || 'Pelanggan'},</p>
    <p>Terima kasih telah bergabung dengan AtayaToko. Kami senang Anda menjadi bagian dari komunitas kami.</p>
    
    <p>Mulai belanja sekarang dan nikmati berbagai keuntungan:</p>
    <ul>
      <li>✓ Produk berkualitas dengan harga terbaik</li>
      <li>✓ Pengiriman cepat dan aman</li>
      <li>✓ Sistem poin rewards</li>
      <li>✓ Promo eksklusif setiap minggu</li>
    </ul>
    
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/products" class="button">Mulai Belanja</a>
  `;

  const html = createEmailTemplate(content, 'Selamat Datang');

  return sendEmail({
    to: user.email,
    subject: 'Selamat Datang di AtayaToko!',
    html,
  });
};

export default {
  sendEmail,
  sendOrderConfirmation,
  sendPasswordReset,
  sendShippingNotification,
  sendOrderDelivered,
  sendWelcomeEmail,
};
