#!/usr/bin/env node

/**
 * Firebase Admin Credentials Setup Helper
 * 
 * Script ini membantu Anda mempersiapkan konfigurasi Firebase Admin SDK
 * dengan memandu melalui proses setup environment variables.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n🔥 Firebase Admin SDK Configuration Helper\n');
  console.log('Script ini akan membantu Anda mengkonfigurasi Firebase Admin credentials.\n');

  const envExamplePath = path.join(__dirname, '.env.example');
  
  if (!fs.existsSync(envExamplePath)) {
    console.error('❌ File .env.example tidak ditemukan!');
    process.exit(1);
  }

  console.log('📋 Langkah-langkah setup:\n');
  console.log('1. Buka Firebase Console: https://console.firebase.google.com/');
  console.log('2. Pilih project Anda');
  console.log('3. Klik icon gear (⚙️) → Project settings');
  console.log('4. Pindah ke tab "Service accounts"');
  console.log('5. Klik "Generate new private key"');
  console.log('6. Download file JSON yang muncul\n');

  const hasJsonFile = await question('Apakah Anda sudah memiliki file JSON service account? (y/n): ');

  if (hasJsonFile.toLowerCase() === 'y') {
    const jsonPath = await question('Masukkan path ke file JSON service account: ');
    
    try {
      const jsonContent = fs.readFileSync(jsonPath.trim(), 'utf8');
      const parsed = JSON.parse(jsonContent);
      
      console.log('\n✅ File JSON valid!');
      console.log(`Project ID: ${parsed.project_id}`);
      console.log(`Client Email: ${parsed.client_email}\n`);

      const useMethod = await question('Pilih metode konfigurasi:\n1. GCP_SERVICE_ACCOUNT_KEY (JSON utuh - Recommended)\n2. Individual Variables\n\nPilihan (1/2): ');

      let envConfig = '';
      
      if (useMethod === '1') {
        // Escape quotes untuk shell
        const escapedJson = jsonContent.replace(/'/g, "'\\''");
        envConfig = `GCP_SERVICE_ACCOUNT_KEY='${escapedJson}'\n`;
        console.log('\n✅ Gunakan variabel: GCP_SERVICE_ACCOUNT_KEY');
      } else {
        const privateKey = parsed.private_key.replace(/\n/g, '\\n');
        envConfig = [
          `FIREBASE_PROJECT_ID=${parsed.project_id}`,
          `FIREBASE_CLIENT_EMAIL=${parsed.client_email}`,
          `FIREBASE_PRIVATE_KEY="${privateKey}"`,
        ].join('\n') + '\n';
        console.log('\n✅ Gunakan variabel individual: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
      }

      const outputPath = path.join(__dirname, '.env.local');
      
      if (fs.existsSync(outputPath)) {
        const shouldOverwrite = await question('\n⚠️  File .env.local sudah ada. Tambahkan/update konfigurasi Firebase? (y/n): ');
        if (shouldOverwrite.toLowerCase() !== 'y') {
          console.log('\n❌ Setup dibatalkan.');
          rl.close();
          return;
        }
        
        // Baca existing content
        let existingContent = fs.readFileSync(outputPath, 'utf8');
        
        // Remove old Firebase Admin config jika ada
        existingContent = existingContent.replace(/GCP_SERVICE_ACCOUNT_KEY=.*?\n/gs, '');
        existingContent = existingContent.replace(/FIREBASE_PROJECT_ID=.*?\n/gs, '');
        existingContent = existingContent.replace(/FIREBASE_CLIENT_EMAIL=.*?\n/gs, '');
        existingContent = existingContent.replace(/FIREBASE_PRIVATE_KEY=.*?\n/gs, '');
        
        // Append new config
        fs.writeFileSync(outputPath, existingContent + '\n# Firebase Admin Configuration\n' + envConfig);
      } else {
        // Copy dari .env.example dan tambahkan config
        const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
        fs.writeFileSync(outputPath, exampleContent + '\n# Your Firebase Admin Configuration\n' + envConfig);
      }

      console.log(`\n✅ Konfigurasi berhasil disimpan ke .env.local`);
      console.log(`\n🧪 Untuk verifikasi, jalankan: npm run build`);
      console.log(`   Warning "Firebase Admin credentials not fully provided" seharusnya hilang.\n`);

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error('Pastikan path file JSON benar dan formatnya valid.\n');
    }
  } else {
    console.log('\n📖 Silakan ikuti langkah-langkah di atas untuk mendapatkan file JSON service account.');
    console.log('Setelah mendapatkannya, jalankan script ini lagi.\n');
  }

  rl.close();
}

main().catch(console.error);