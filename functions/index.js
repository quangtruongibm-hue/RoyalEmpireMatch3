const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();

function cors(req, res) {
  const origin = req.get('Origin') || '';
  const allowedOrigins = new Set([
    'https://truongphuctechnology.com',
    'https://www.truongphuctechnology.com'
  ]);
  if (allowedOrigins.has(origin)) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function adminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}

async function requireAdmin(req) {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('UNAUTHENTICATED');
  const decoded = await auth.verifyIdToken(header.slice(7));
  const email = String(decoded.email || '').toLowerCase();
  const allowed = adminEmails();
  if (!email || !allowed.includes(email)) throw new Error('ADMIN_REQUIRED');
  return decoded;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function serializeValue(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([k, v]) => { out[k] = serializeValue(v); });
    return out;
  }
  return value;
}

function json(req, res, status, body) {
  cors(req, res);
  return res.status(status).json(body);
}

exports.sendFcmNotification = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '512MiB' }, async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return json(req, res, 405, { error: 'Method not allowed.' });

  try {
    const adminUser = await requireAdmin(req);
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const messageBody = String(body.body || '').trim();
    const audience = String(body.audience || '');
    const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
    const tokens = [...new Set(Array.isArray(body.tokens) ? body.tokens.filter((x) => typeof x === 'string' && x.trim()) : [])];
    const testOnly = Boolean(body.testOnly);

    if (!title || !messageBody) return json(req, res, 400, { error: 'Thiếu title hoặc body.' });
    if (!tokens.length) return json(req, res, 400, { error: 'Không có FCM token.' });
    if (tokens.length > 5000) return json(req, res, 400, { error: 'Mỗi lần gửi tối đa 5.000 token.' });

    // FCM data values must be strings.
    const stringData = {};
    Object.entries(data).forEach(([key, value]) => {
      stringData[String(key)] = typeof value === 'string' ? value : JSON.stringify(value);
    });

    let successCount = 0;
    let failureCount = 0;
    const responses = [];

    for (const batch of chunk(tokens, 500)) {
      const result = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body: messageBody },
        data: stringData,
        android: { priority: 'high', notification: { channelId: 'default', sound: 'default' } }
      });
      successCount += result.successCount;
      failureCount += result.failureCount;
      result.responses.forEach((r, i) => {
        if (!r.success) responses.push({ index: i, error: r.error?.code || r.error?.message || 'unknown' });
      });
    }

    const campaignRef = await db.collection('fcm_campaigns').add({
      title,
      body: messageBody,
      audience,
      testOnly,
      tokenCount: tokens.length,
      successCount,
      failureCount,
      createdAt: FieldValue.serverTimestamp(),
      createdByUid: adminUser.uid,
      createdByEmail: adminUser.email || ''
    });

    logger.info('FCM campaign sent', { campaignId: campaignRef.id, tokenCount: tokens.length, successCount, failureCount });
    return json(req, res, 200, { ok: true, campaignId: campaignRef.id, successCount, failureCount });
  } catch (error) {
    logger.error('sendFcmNotification failed', error);
    const message = error.message === 'UNAUTHENTICATED' ? 'Bạn chưa đăng nhập Admin.'
      : error.message === 'ADMIN_REQUIRED' ? 'Tài khoản này không có quyền Admin backend.'
      : (error.message || 'Lỗi server.');
    return json(req, res, 403, { error: message });
  }
});

exports.getAdminPlayers = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '512MiB' }, async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return json(req, res, 405, { error: 'Method not allowed.' });
  try {
    await requireAdmin(req);
    const snapshot = await db.collection('players').get();
    const players = snapshot.docs.map((doc) => ({ uid: doc.id, ...serializeValue(doc.data()) }));
    return json(req, res, 200, { ok: true, players });
  } catch (error) {
    logger.error('getAdminPlayers failed', error);
    const message = error.message === 'UNAUTHENTICATED' ? 'Bạn chưa đăng nhập Admin.'
      : error.message === 'ADMIN_REQUIRED' ? 'Tài khoản này không có quyền Admin backend.'
      : (error.message || 'Lỗi server.');
    return json(req, res, 403, { error: message });
  }
});

exports.getFcmHistory = onRequest({ region: 'us-central1', timeoutSeconds: 60, memory: '256MiB' }, async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return json(req, res, 405, { error: 'Method not allowed.' });
  try {
    await requireAdmin(req);
    const snapshot = await db.collection('fcm_campaigns').orderBy('createdAt', 'desc').limit(50).get();
    const campaigns = snapshot.docs.map((doc) => ({ id: doc.id, ...serializeValue(doc.data()) }));
    return json(req, res, 200, { ok: true, campaigns });
  } catch (error) {
    logger.error('getFcmHistory failed', error);
    const message = error.message === 'UNAUTHENTICATED' ? 'Bạn chưa đăng nhập Admin.'
      : error.message === 'ADMIN_REQUIRED' ? 'Tài khoản này không có quyền Admin backend.'
      : (error.message || 'Lỗi server.');
    return json(req, res, 403, { error: message });
  }
});

