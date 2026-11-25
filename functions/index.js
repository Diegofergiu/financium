/**
 * Cloud Functions de Mi Bolsillo.
 *
 * - avisosDiarios: corre cada hora; a cada usuario le envía, a la hora que eligió, notificaciones
 *   push de cheques por vencer/vencidos y presupuestos al 80 %/100 %, aunque la app esté cerrada.
 * - resumenSemanal: los lunes 9:30, cuánto entró/salió la semana anterior y cheques de la semana.
 * - leerComprobante / sugerirCategoria: IA (Gemini) para leer fotos de facturas, tickets y cheques.
 * - enviarPruebaPush: la llama la app desde Ajustes para comprobar que las notificaciones llegan.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { runDailyReminders, runWeeklySummary, sendToUser, localISO } = require('./reminders');
const { defineSecret } = require('firebase-functions/params');
const ai = require('./ai');

// Clave de Gemini guardada como secreto: npx firebase-tools functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

function aiClient() {
  if (process.env.FUNCTIONS_EMULATOR === 'true' && process.env.AI_FAKE === '1') return ai.fakeClient();
  const key = GEMINI_API_KEY.value();
  if (!key) throw new HttpsError('failed-precondition', 'La lectura con IA no está configurada (falta GEMINI_API_KEY).');
  const { GoogleGenAI } = require('@google/genai');
  return new GoogleGenAI({ apiKey: key });
}

async function checkQuota(uid) {
  try {
    return await ai.consumeQuota(getFirestore(), uid, localISO());
  } catch (e) {
    if (e.message === 'limit') throw new HttpsError('resource-exhausted', `Llegaste al límite de ${ai.DAILY_LIMIT} lecturas con IA por hoy.`);
    throw e;
  }
}

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 2, memory: '256MiB' });

// Corre cada hora: cada usuario recibe sus avisos a la hora que eligió en Ajustes
exports.avisosDiarios = onSchedule(
  { schedule: '0 * * * *', timeZone: 'America/Argentina/Buenos_Aires', retryCount: 1, timeoutSeconds: 300 },
  async () => {
    const summary = await runDailyReminders({ db: getFirestore(), messaging: getMessaging(), FieldValue, FieldPath, log: logger });
    logger.info('Avisos diarios enviados', summary);
  }
);

exports.resumenSemanal = onSchedule(
  { schedule: '30 9 * * 1', timeZone: 'America/Argentina/Buenos_Aires', retryCount: 1, timeoutSeconds: 300 },
  async () => {
    const r = await runWeeklySummary({ db: getFirestore(), messaging: getMessaging(), FieldValue, FieldPath, log: logger });
    logger.info('Resumen semanal enviado', r);
  }
);

exports.enviarPruebaPush = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Tenés que iniciar sesión.');
  const ref = getFirestore().collection('users').doc(request.auth.uid);
  const snap = await ref.get();
  const tokens = Object.keys((snap.exists && snap.data().fcmTokens) || {});
  if (!tokens.length) throw new HttpsError('failed-precondition', 'Este usuario no tiene dispositivos registrados.');
  const { sent, invalid } = await sendToUser(getMessaging(), tokens, [
    {
      tag: 'mibolsillo-test',
      title: '¡Las notificaciones funcionan! 🎉',
      body: 'Este aviso llegó desde el servidor: te va a avisar aunque la app esté cerrada.',
      url: '/settings',
    },
  ]);
  if (invalid.length) {
    const args = invalid.flatMap((t) => [new FieldPath('fcmTokens', t), FieldValue.delete()]);
    await ref.update(...args);
  }
  return { sent, devices: tokens.length - invalid.length };
});

/** Lee una foto de factura, ticket o cheque y devuelve los datos para cargarla. */
exports.leerComprobante = onCall({ secrets: [GEMINI_API_KEY], memory: '512MiB', timeoutSeconds: 60, cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Tenés que iniciar sesión.');
  const { imageBase64, mimeType, categories, walletName, mode } = request.data || {};
  if (!ai.MODES.includes(mode)) throw new HttpsError('invalid-argument', 'Indicá si es gasto, ingreso o cheque.');
  if (typeof imageBase64 !== 'string' || !/^image\/(jpeg|png|webp|heic|heif)$/.test(String(mimeType))) {
    throw new HttpsError('invalid-argument', 'Mandá una foto (JPG, PNG o WebP).');
  }
  if (imageBase64.length * 0.75 > ai.MAX_IMAGE_BYTES) throw new HttpsError('invalid-argument', 'La foto es demasiado grande.');
  const remaining = await checkQuota(request.auth.uid);
  try {
    const result = await ai.readDocument({
      client: aiClient(),
      model: process.env.GEMINI_MODEL || ai.DEFAULT_MODEL,
      imageBase64,
      mimeType,
      context: {
        mode,
        walletName: String(walletName || '').slice(0, 80),
        categories: Array.isArray(categories) ? categories.map(String).slice(0, 60) : [],
        today: localISO(),
      },
    });
    return { ...result, remaining };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.error('Error leyendo comprobante', e);
    throw new HttpsError('internal', 'No se pudo leer el comprobante. Probá con otra foto, más nítida.');
  }
});

/** Sugiere una categoría a partir de la descripción. */
exports.sugerirCategoria = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 30, cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Tenés que iniciar sesión.');
  const { description, categories } = request.data || {};
  if (!description || !Array.isArray(categories) || !categories.length) return { category: '' };
  await checkQuota(request.auth.uid);
  try {
    const category = await ai.suggestCategory({ client: aiClient(), model: process.env.GEMINI_MODEL || ai.DEFAULT_MODEL, description, categories: categories.map(String).slice(0, 60) });
    return { category };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    logger.error('Error sugiriendo categoría', e);
    throw new HttpsError('internal', 'No se pudo sugerir la categoría.');
  }
});

