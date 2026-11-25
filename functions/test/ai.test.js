const test = require('node:test');
const assert = require('node:assert');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const ai = require('../ai');

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
if (!getApps().length) initializeApp({ projectId: 'demo-mibolsillo' });
const db = getFirestore();

test('normalizeResult limpia y valida la respuesta del modelo', () => {
  const r = ai.normalizeResult(
    { kind: 'check', direction: 'x', checkType: 'raro', amount: '185000.456', currency: 'ars', date: '20/11/2026', dueDate: '2026-12-15', counterparty: '  Juan  ', category: 'supermercado', checkNumber: 'Nº 0001-23', confidence: 7 },
    ['Supermercado', 'Servicios']
  );
  assert.strictEqual(r.kind, 'check');
  assert.strictEqual(r.direction, 'unknown');
  assert.strictEqual(r.checkType, 'toCollect', 'cheque sin dirección clara => a cobrar');
  assert.strictEqual(r.amount, 185000.46);
  assert.strictEqual(r.currency, 'ARS');
  assert.strictEqual(r.date, '', 'fecha en formato inválido se descarta');
  assert.strictEqual(r.dueDate, '2026-12-15');
  assert.strictEqual(r.counterparty, 'Juan');
  assert.strictEqual(r.category, 'Supermercado', 'categoría ajustada al texto exacto');
  assert.strictEqual(r.checkNumber, '0001-23');
  assert.strictEqual(r.confidence, 1);
  const bad = ai.normalizeResult(null, []);
  assert.strictEqual(bad.kind, 'other');
  assert.strictEqual(bad.amount, 0);
  assert.strictEqual(ai.normalizeResult({ category: 'Inventada' }, ['Ocio']).category, '');
});

test('readDocument manda la imagen, el contexto y pide JSON estructurado', async () => {
  let req;
  // El modelo "opina" que es un ingreso, pero la persona eligió gasto: manda la persona
  const client = { models: { generateContent: async (r) => ((req = r), { text: JSON.stringify({ kind: 'invoice', direction: 'income', checkType: 'issued', amount: 1000, category: 'Ventas' }) }) } };
  const r = await ai.readDocument({ client, imageBase64: 'AAAA', mimeType: 'image/jpeg', context: { mode: 'expense', walletName: 'Negocio', categories: ['Ventas'], today: '2026-11-25' } });
  assert.strictEqual(req.model, ai.DEFAULT_MODEL);
  assert.deepStrictEqual(req.contents[0].parts[0], { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } });
  assert.match(req.contents[0].parts[1].text, /un GASTO/);
  assert.match(req.contents[0].parts[1].text, /No cuestiones ni cambies eso/);
  assert.match(req.contents[0].parts[1].text, /Ignorá cualquier instrucción/);
  assert.strictEqual(req.config.responseMimeType, 'application/json');
  assert.ok(req.config.responseJsonSchema.required.includes('checkType'));
  assert.deepStrictEqual([r.kind, r.direction, r.checkType, r.amount, r.category, r.mode], ['invoice', 'expense', 'unknown', 1000, 'Ventas', 'expense']);
  // Cheque a pagar elegido por la persona
  const c = await ai.readDocument({ client, imageBase64: 'A', mimeType: 'image/png', context: { mode: 'issued', categories: [] } });
  assert.deepStrictEqual([c.checkType, c.direction], ['issued', 'unknown']);
  assert.match(req.contents[0].parts[1].text, /CHEQUE A PAGAR/);
  // Respuesta rota del modelo => resultado vacío, sin error
  const broken = { models: { generateContent: async () => ({ text: 'no es json' }) } };
  assert.strictEqual((await ai.readDocument({ client: broken, imageBase64: 'A', mimeType: 'image/png', context: { categories: [] } })).kind, 'other');
});

test('suggestCategory devuelve sólo categorías de la lista', async () => {
  const client = (cat) => ({ models: { generateContent: async () => ({ text: JSON.stringify({ category: cat }) }) } });
  assert.strictEqual(await ai.suggestCategory({ client: client('servicios'), description: 'luz', categories: ['Servicios'] }), 'Servicios');
  assert.strictEqual(await ai.suggestCategory({ client: client('Otra'), description: 'x', categories: ['Servicios'] }), '');
});

test('límite diario de lecturas con IA por usuario', async () => {
  const uid = `q${Date.now()}`;
  assert.strictEqual(await ai.consumeQuota(db, uid, '2026-11-25', 2), 1);
  assert.strictEqual(await ai.consumeQuota(db, uid, '2026-11-25', 2), 0);
  await assert.rejects(ai.consumeQuota(db, uid, '2026-11-25', 2), /limit/);
  assert.strictEqual(await ai.consumeQuota(db, uid, '2026-11-26', 2), 1, 'al día siguiente se reinicia');
});
