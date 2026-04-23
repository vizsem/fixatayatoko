/**
 * Test script untuk SMS Notifications (Twilio)
 * Usage: node scripts/test-sms.js
 */

require('dotenv').config({ path: '.env.local' });
const twilio = require('twilio');

async function testSMS() {
  console.log('🧪 Testing SMS Configuration...\n');

  // Check environment variables
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.error('❌ Error: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER must be set in .env.local');
    process.exit(1);
  }

  if (!process.env.TEST_PHONE_NUMBER) {
    console.error('❌ Error: TEST_PHONE_NUMBER must be set in .env.local (format: +6281234567890)');
    process.exit(1);
  }

  try {
    // Create Twilio client
    console.log('✓ Initializing Twilio client...');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio client initialized!\n');

    // Send test SMS
    console.log(`📤 Sending test SMS to ${process.env.TEST_PHONE_NUMBER}...`);
    const message = await client.messages.create({
      body: `🎉 AtayaToko SMS System Test\n\nThis is a test message from AtayaToko notification system.\n\nSent at: ${new Date().toLocaleString('id-ID')}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.TEST_PHONE_NUMBER,
    });

    console.log('✅ Test SMS sent successfully!');
    console.log('Message SID:', message.sid);
    console.log('Status:', message.status);
    console.log('\n🎉 SMS system is ready to use!');
  } catch (error) {
    console.error('❌ Error sending test SMS:');
    console.error(error.message);
    
    if (error.code === 20003) {
      console.error('\n💡 Authentication Error: Check your Account SID and Auth Token');
    } else if (error.code === 21608) {
      console.error('\n💡 Phone Number Error: Verify the phone number format (+62xxx)');
    } else if (error.code === 21614) {
      console.error('\n💡 From Number Error: Make sure you own the Twilio phone number');
    } else if (error.code === 21612) {
      console.error('\n💡 Trial Account: Upgrade to send to non-verified numbers');
    }
    
    console.error('\n💡 Tips:');
    console.error('1. Sign up at https://www.twilio.com/');
    console.error('2. Get credentials from Twilio Console');
    console.error('3. Buy a phone number');
    console.error('4. For trial accounts, verify recipient numbers first');
    process.exit(1);
  }
}

testSMS();
