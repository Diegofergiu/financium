/**
 * Cloud Functions de Mi Bolsillo.
 *
 * - avisosDiarios: todos los días a las 9:00 (hora de Argentina) envía notificaciones
 *   push de cheques por vencer/vencidos y presupuestos al 80 %/100 %, aunque la app esté cerrada.
 * - enviarPruebaPush: la llama la app desde Ajustes para comprobar que las notificaciones llegan.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { runDailyReminders, sendToUser } = require('./reminders');

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 2, memory: '256MiB' });

exports.avisosDiarios = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'America/Argentina/Buenos_Aires', retryCount: 1, timeoutSeconds: 300 },
  async () => {
    const summary = await runDailyReminders({ db: getFirestore(), messaging: getMessaging(), FieldValue, FieldPath, log: logger });
    logger.info('Avisos diarios enviados', summary);
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
