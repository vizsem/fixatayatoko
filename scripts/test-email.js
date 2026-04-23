/**
 * Test script untuk Email Notifications
 * Usage: node scripts/test-email.js
 */

require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('🧪 Testing Email Configuration...\n');

  // Check environment variables
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ Error: SMTP_USER and SMTP_PASS must be set in .env.local');
    process.exit(1);
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    // Verify connection
    console.log('✓ Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    // Send test email
    console.log('📤 Sending test email...');
    const result = await transporter.sendMail({
      from: `"AtayaToko Test" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: process.env.TEST_EMAIL || process.env.SMTP_USER, // Send to self if TEST_EMAIL not set
      subject: 'Test Email - AtayaToko Notification System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #10b981;">✅ Email System Working!</h1>
          <p>This is a test email from AtayaToko notification system.</p>
          <p>If you received this email, your SMTP configuration is correct.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="color: #6b7280; font-size: 12px;">
            Sent at: ${new Date().toLocaleString('id-ID')}
          </p>
        </div>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('\n🎉 Email system is ready to use!');
  } catch (error) {
    console.error('❌ Error sending test email:');
    console.error(error.message);
    console.error('\n💡 Tips:');
    console.error('1. Check if SMTP credentials are correct');
    console.error('2. For Gmail, make sure to use App Password (not regular password)');
    console.error('3. Enable 2-Factor Authentication in Google Account');
    console.error('4. Generate App Password at: https://myaccount.google.com/apppasswords');
    process.exit(1);
  }
}

testEmail();
