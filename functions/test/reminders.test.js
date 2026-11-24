// Ejecutar con el emulador de Firestore activo:
//   npx firebase-tools emulators:exec --only firestore "npm --prefix functions test"
const test = require('node:test');
const assert = require('node:assert');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { runDailyReminders, computeWalletAlerts, localISO, daysBetween } = require('../reminders');

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
initializeApp({ projectId: 'demo-mibolsillo' });
const db = getFirestore();

function fakeMessaging({ invalid = [] } = {}) {
  const sent = [];
  return {
    sent,
    async sendEach(msgs) {
      return {
        responses: msgs.map((m) => {
          if (invalid.includes(m.token)) return { success: false, error: { code: 'messaging/registration-token-not-registered' } };
          sent.push(m);
          return { success: true };
        }),
      };
    },
  };
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test('utilidades de fecha', () => {
  assert.strictEqual(daysBetween('2026-11-24', '2026-11-26'), 2);
  assert.strictEqual(daysBetween('2026-11-24', '2026-11-21'), -3);
  // 02:00 UTC del 25 = 23:00 del 24 en Argentina
  assert.strictEqual(localISO(new Date('2026-11-25T02:00:00Z')), '2026-11-24');
});

test('computeWalletAlerts usa los mismos ids que la app', () => {
  const today = '2026-11-24';
  const alerts = computeWalletAlerts({
    wallet: { name: 'Casa', currency: 'ARS' },
    checks: [
      { id: 'a', status: 'pending', type: 'toCollect', dueDate: '2026-11-26', amount: 1000, issuerRecipient: 'Carlos' },
      { id: 'b', status: 'pending', type: 'issued', dueDate: '2026-11-21', amount: 500, issuerRecipient: 'Ferretería' },
      { id: 'c', status: 'pending', type: 'issued', dueDate: '2026-12-30', amount: 500 },
      { id: 'd', status: 'cleared', type: 'issued', dueDate: '2026-11-24', amount: 500 },
    ],
    budgets: [{ id: 'b1', name: 'Súper', categoryId: 'super', limitAmount: 100 }],
    transactions: [
      { type: 'expense', date: '2026-11-03', categoryId: 'super', amount: 85 },
      { type: 'expense', date: '2026-10-03', categoryId: 'super', amount: 999 },
    ],
    categories: [{ id: 'super', name: 'Supermercado' }],
    notifyDays: 7,
    today,
  });
  assert.deepStrictEqual(alerts.map((a) => a.id).sort(), ['budget-b1-2026-11-near', 'check-a-2026-11-26-soon', 'check-b-2026-11-21-overdue']);
});

test('runDailyReminders envía una sola vez y limpia tokens inválidos', async () => {
  const uid = `u${Date.now()}`;
  const today = localISO();
  const wallet = db.collection('wallets').doc();
  await wallet.set({ name: 'Mis finanzas', ownerId: uid, members: { [uid]: 'owner' }, currency: 'ARS' });
  await wallet.collection('checks').doc('ck1').set({ status: 'pending', type: 'toCollect', dueDate: addDays(today, 1), amount: 150000, issuerRecipient: 'Carlos', bank: 'Nación' });
  await wallet.collection('checks').doc('ck2').set({ status: 'pending', type: 'issued', dueDate: addDays(today, 20), amount: 1, issuerRecipient: 'Lejos' });
  await db.collection('users').doc(uid).set({
    id: uid,
    pushEnabled: true,
    notifyDays: 3,
    fcmTokens: { 'tok:bueno_1': { ua: 'x' }, 'tok:viejo-2': { ua: 'y' } },
    sentAlerts: { 'check-viejo-2020-01-01-soon': '2020-01-01' },
  });

  const messaging = fakeMessaging({ invalid: ['tok:viejo-2'] });
  const s1 = await runDailyReminders({ db, messaging, FieldValue, FieldPath, log: { error() {} } });
  assert.ok(s1.users >= 1);
  const mine = messaging.sent.filter((m) => m.token === 'tok:bueno_1');
  assert.strictEqual(mine.length, 1, 'un aviso (el cheque de 20 días queda fuera de los 3 días)');
  assert.match(mine[0].data.title, /Cheque a cobrar/);
  assert.strictEqual(mine[0].data.tag, `check-ck1-${addDays(today, 1)}-soon`);
  assert.strictEqual(mine[0].data.url, '/checks');

  const u = (await db.collection('users').doc(uid).get()).data();
  assert.deepStrictEqual(Object.keys(u.fcmTokens), ['tok:bueno_1'], 'token inválido eliminado');
  assert.ok(u.sentAlerts[`check-ck1-${addDays(today, 1)}-soon`], 'aviso marcado como enviado');
  assert.ok(!u.sentAlerts['check-viejo-2020-01-01-soon'], 'avisos viejos limpiados');

  const messaging2 = fakeMessaging();
  await runDailyReminders({ db, messaging: messaging2, FieldValue, FieldPath, log: { error() {} } });
  assert.strictEqual(messaging2.sent.filter((m) => m.token === 'tok:bueno_1').length, 0, 'no repite el mismo aviso');

  // Al día siguiente el cheque "vence hoy": es un aviso nuevo
  const tomorrow = new Date(Date.now() + 864e5);
  const messaging3 = fakeMessaging();
  await runDailyReminders({ db, messaging: messaging3, FieldValue, FieldPath, now: tomorrow, log: { error() {} } });
  const m3 = messaging3.sent.filter((m) => m.token === 'tok:bueno_1');
  assert.strictEqual(m3.length, 1);
  assert.match(m3[0].data.body, /Vence hoy/);
});

test('usuarios sin pushEnabled no reciben nada', async () => {
  const uid = `n${Date.now()}`;
  const wallet = db.collection('wallets').doc();
  await wallet.set({ name: 'X', ownerId: uid, members: { [uid]: 'owner' } });
  await wallet.collection('checks').doc('c').set({ status: 'pending', type: 'issued', dueDate: localISO(), amount: 10 });
  await db.collection('users').doc(uid).set({ id: uid, pushEnabled: false, fcmTokens: { 'tok:off': {} } });
  const messaging = fakeMessaging();
  await runDailyReminders({ db, messaging, FieldValue, FieldPath, log: { error() {} } });
  assert.strictEqual(messaging.sent.filter((m) => m.token === 'tok:off').length, 0);
});

test('processRecurring anota los gastos fijos automáticos una sola vez', async () => {
  const { processRecurring, runWeeklySummary } = require('../reminders');
  const uid = `r${Date.now()}`;
  const today = localISO();
  const month = today.slice(0, 7);
  const wallet = db.collection('wallets').doc();
  await wallet.set({ name: 'Casa', ownerId: uid, members: { [uid]: 'owner' }, currency: 'ARS' });
  await wallet.collection('recurring').doc('alq').set({ type: 'expense', amount: 300000, description: 'Alquiler', categoryId: 'c', dayOfMonth: 1, autoCreate: true, active: true, lastCreatedMonth: null });
  await wallet.collection('recurring').doc('manual').set({ type: 'expense', amount: 1, description: 'Luz', dayOfMonth: 1, autoCreate: false, active: true });
  await wallet.collection('recurring').doc('futuro').set({ type: 'expense', amount: 1, description: 'X', dayOfMonth: 31, autoCreate: true, active: true });

  const c1 = await processRecurring({ db, FieldValue, today });
  const mine = c1.filter((c) => c.walletId === wallet.id).map((c) => c.recurring.id);
  assert.ok(mine.includes('alq'));
  assert.ok(!mine.includes('manual'), 'los manuales no se anotan solos');
  const tx = await wallet.collection('transactions').doc(`rec-alq-${month}`).get();
  assert.ok(tx.exists);
  assert.strictEqual(tx.data().amount, 300000);
  assert.strictEqual(tx.data().walletOwnerId, uid);
  assert.strictEqual((await wallet.collection('recurring').doc('alq').get()).data().lastCreatedMonth, month);

  const c2 = await processRecurring({ db, FieldValue, today });
  assert.strictEqual(c2.filter((c) => c.walletId === wallet.id && c.recurring.id === 'alq').length, 0, 'no se repite');

  // Resumen semanal: movimiento de ayer y usuario con push
  const y = addDays(today, -1);
  await wallet.collection('transactions').add({ type: 'expense', amount: 5000, date: y, categoryId: 'c' });
  await wallet.collection('transactions').add({ type: 'transfer', amount: 999999, date: y });
  await db.collection('users').doc(uid).set({ id: uid, pushEnabled: true, fcmTokens: { 'tok:sem': {} } });
  const messaging = fakeMessaging();
  await runWeeklySummary({ db, messaging, FieldValue, FieldPath, log: { error() {} } });
  const m = messaging.sent.find((x) => x.token === 'tok:sem');
  assert.ok(m, 'envía resumen');
  assert.match(m.data.body, /salieron/);
  assert.ok(!m.data.body.includes('999.999'), 'las transferencias no suman');
});
