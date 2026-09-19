#!/bin/bash
# ============================================
# Script: push-env-to-vercel.sh
# Tujuan: Push semua env vars dari .env.local ke Vercel
# Cara pakai:
#   chmod +x scripts/push-env-to-vercel.sh
#   ./scripts/push-env-to-vercel.sh
# ============================================

set -e

# Gunakan Node versi yang benar (24)
NODE_BIN="$HOME/.nvm/versions/node/v24.12.0/bin"
NPX="$NODE_BIN/npx"

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ File $ENV_FILE tidak ditemukan!"
  exit 1
fi

echo "🔐 Login Vercel..."
$NPX vercel login

echo ""
echo "📤 Push environment variables ke Vercel (Production)..."

# Baca setiap baris dari .env.local
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "$line" ]] && continue
  key=$(echo "$line" | cut -d= -f1)
  value=$(echo "$line" | cut -d= -f2-)
  value="${value%\"}"
  value="${value#\"}"
  if [ -n "$key" ] && [ -n "$value" ]; then
    echo "  ➤ Setting: $key"
    echo "$value" | $NPX vercel env add "$key" production --force 2>/dev/null || true
  fi
done < "$ENV_FILE"

echo ""
echo "✅ Selesai! Semua env vars sudah di-push ke Vercel."
echo "🚀 Trigger redeploy..."
$NPX vercel --prod
