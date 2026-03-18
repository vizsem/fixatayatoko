import 'server-only';

import crypto from 'crypto';

type SnapToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedToken: SnapToken | null = null;

const mustEnv = (key: string) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
};

const optionalEnv = (key: string) => process.env[key] || '';

const pad2 = (n: number) => String(n).padStart(2, '0');

const isoJakartaTimestamp = (d = new Date()) => {
  const ms = d.getTime() + 7 * 60 * 60 * 1000;
  const j = new Date(ms);
  const yyyy = j.getUTCFullYear();
  const mm = pad2(j.getUTCMonth() + 1);
  const dd = pad2(j.getUTCDate());
  const hh = pad2(j.getUTCHours());
  const min = pad2(j.getUTCMinutes());
  const ss = pad2(j.getUTCSeconds());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+07:00`;
};

const minifyJson = (body: unknown) => {
  if (body == null) return '';
  return JSON.stringify(body);
};

const sha256HexLower = (s: string) => crypto.createHash('sha256').update(s).digest('hex').toLowerCase();

const hmacSha512Base64 = (secret: string, data: string) =>
  crypto.createHmac('sha512', secret).update(data).digest('base64');

const rsaSha256Base64 = (privateKeyPem: string, data: string) => {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKeyPem, 'base64');
};

export const briDeriveExternalId = (orderId: string) => {
  const hex = sha256HexLower(orderId);
  const digits = hex.replace(/[a-f]/g, (c) => String(c.charCodeAt(0) - 87));
  return digits.slice(0, 36).padEnd(36, '0');
};

const parseTokenResponse = (data: any) => {
  const accessToken =
    String(
      data?.accessToken ||
        data?.access_token ||
        data?.token ||
        data?.tokenResponse?.accessToken ||
        '',
    );
  if (!accessToken) throw new Error('BRI token response missing accessToken');
  const expiresInSeconds =
    Number(
      data?.expiresIn ||
        data?.expires_in ||
        data?.tokenResponse?.expiresIn ||
        900,
    ) || 900;
  const now = Date.now();
  const skewMs = 60_000;
  return { accessToken, expiresAtMs: now + expiresInSeconds * 1000 - skewMs };
};

export const briGetB2BAccessToken = async () => {
  if (cachedToken && cachedToken.expiresAtMs > Date.now()) return cachedToken.accessToken;

  const baseUrl = mustEnv('BRI_BASE_URL');
  const tokenPath = optionalEnv('BRI_SNAP_TOKEN_PATH') || '/api/v1/access-token/b2b';

  const clientId = mustEnv('BRI_CLIENT_ID');
  const privateKey = mustEnv('BRI_SNAP_PRIVATE_KEY').replace(/\\n/g, '\n');

  const timestamp = isoJakartaTimestamp();
  const signature = rsaSha256Base64(privateKey, `${clientId}|${timestamp}`);

  const body = { grantType: 'client_credentials' };

  const resp = await fetch(`${baseUrl}${tokenPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-TIMESTAMP': timestamp,
      'X-CLIENT-KEY': clientId,
      'X-SIGNATURE': signature,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = String(data?.responseMessage || data?.error || data?.message || 'Token request failed');
    throw new Error(`BRI token error: ${msg}`);
  }

  cachedToken = parseTokenResponse(data);
  return cachedToken.accessToken;
};

export const briSnapRequest = async <T = any>(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  externalId: string;
}) => {
  const baseUrl = mustEnv('BRI_BASE_URL');
  const clientSecret = mustEnv('BRI_CLIENT_SECRET');
  const partnerId = mustEnv('BRI_SNAP_PARTNER_ID');
  const channelId = mustEnv('BRI_SNAP_CHANNEL_ID');

  const accessToken = await briGetB2BAccessToken();
  const timestamp = isoJakartaTimestamp();
  const bodyMin = minifyJson(opts.body);
  const bodyHash = sha256HexLower(bodyMin);

  const stringToSign = `${opts.method}:${opts.path}:${accessToken}:${bodyHash}:${timestamp}`;
  const signature = hmacSha512Base64(clientSecret, stringToSign);

  const resp = await fetch(`${baseUrl}${opts.path}`, {
    method: opts.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-TIMESTAMP': timestamp,
      'X-SIGNATURE': signature,
      'X-PARTNER-ID': partnerId,
      'CHANNEL-ID': channelId,
      'X-EXTERNAL-ID': opts.externalId,
    },
    body: opts.method === 'GET' ? undefined : bodyMin,
    cache: 'no-store',
  });

  const data = (await resp.json().catch(() => ({}))) as T;
  return { ok: resp.ok, status: resp.status, data };
};

export const briVerifyAsymmetricSignature = (opts: {
  publicKeyPem: string;
  clientKey: string;
  timestamp: string;
  signatureBase64: string;
}) => {
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(`${opts.clientKey}|${opts.timestamp}`);
  verify.end();
  return verify.verify(opts.publicKeyPem, opts.signatureBase64, 'base64');
};

