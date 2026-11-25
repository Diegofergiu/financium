// Pruebas de las reglas de Firestore y Storage contra los emuladores.
//   npx firebase-tools emulators:exec --only auth,firestore,storage "node --test tests/"
import test from 'node:test';
import assert from 'node:assert';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, writeBatch, FieldPath, deleteField,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator, ref, uploadString, getBytes } from 'firebase/storage';

const PROJECT = process.env.GCLOUD_PROJECT || 'demo-mibolsillo';
let n = 0;

async function newUser(label, { verified = true } = {}) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake', authDomain: 'x', storageBucket: `${PROJECT}.appspot.com` }, `${label}-${n++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  const email = `${label}${Date.now()}${n}@test.com`;
  const cred = await createUserWithEmailAndPassword(auth, email, 'secreto123');
  if (verified) {
    await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=fake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: cred.user.uid, emailVerified: true }),
    });
    await cred.user.getIdToken(true);
  }
  return { app, db, storage, uid: cred.user.uid, email: email.toLowerCase() };
}

const ok = (p) => assert.doesNotReject(p);
const denied = (p) => assert.rejects(p, (e) => /permission|PERMISSION|unauthorized/i.test(String(e.code || e.message)));

async function createWallet(u, name = 'Casa') {
  const w = doc(collection(u.db, 'wallets'));
  const b = writeBatch(u.db);
  const members = { [u.uid]: 'owner' };
  b.set(w, { name, ownerId: u.uid, members, memberInfo: { [u.uid]: { email: u.email } }, currency: 'ARS', createdAt: serverTimestamp() });
  b.set(doc(collection(u.db, 'wallets', w.id, 'categories')), { name: 'X', walletOwnerId: u.uid, walletMembersMap: members });
  b.set(doc(collection(u.db, 'wallets', w.id, 'accounts')), { name: 'Efectivo', currency: 'ARS', walletOwnerId: u.uid, walletMembersMap: members });
  await b.commit();
  return w;
}
const myWallets = (u) => getDocs(query(collection(u.db, 'wallets'), where(new FieldPath('members', u.uid), 'in', ['owner', 'editor', 'reader'])));
const tx = (u, w, ownerId, extra = {}) =>
  setDoc(doc(collection(u.db, 'wallets', w.id, 'transactions')), { type: 'expense', amount: 10, date: '2026-01-01', walletOwnerId: ownerId, walletMembersMap: {}, ...extra });

test('dueño: libro, movimientos y consultas', async () => {
  const a = await newUser('a');
  const w = await createWallet(a);
  await ok(tx(a, w, a.uid));
  await denied(tx(a, w, a.uid, { amount: -5 }));
  const list = await myWallets(a);
  assert.ok(list.docs.some((d) => d.id === w.id));
  await ok(updateDoc(w, { name: 'Casa 2' }));
  await denied(updateDoc(w, { members: { [a.uid]: 'editor' } }));
});

test('extraños no ven ni escriben libros ajenos', async () => {
  const a = await newUser('a');
  const c = await newUser('c');
  const w = await createWallet(a);
  await denied(getDocs(collection(c.db, 'wallets')));
  await denied(getDoc(doc(c.db, 'wallets', w.id)));
  await denied(getDocs(collection(c.db, 'wallets', w.id, 'transactions')));
  await denied(tx(c, w, c.uid));
  await denied(tx(c, w, a.uid));
  await denied(updateDoc(doc(c.db, 'wallets', w.id), new FieldPath('members', c.uid), 'owner'));
  // Sin invitación no puede sumarse aunque pida rol de editor
  await denied(updateDoc(doc(c.db, 'wallets', w.id), new FieldPath('members', c.uid), 'editor'));
  const mine = await myWallets(c);
  assert.strictEqual(mine.size, 0);
});

test('invitación: aceptar como editor, permisos y salir', async () => {
  const a = await newUser('a');
  const b = await newUser('b');
  const w = await createWallet(a);
  const invId = `${w.id}__${b.email}`;
  // Sólo el dueño invita, con id y correo coherentes
  await denied(setDoc(doc(b.db, 'invites', invId), { walletId: w.id, email: b.email, role: 'editor', status: 'pending', invitedBy: b.uid }));
  await ok(setDoc(doc(a.db, 'invites', invId), { walletId: w.id, walletName: 'Casa', email: b.email, role: 'editor', status: 'pending', invitedBy: a.uid, invitedByName: 'A' }));
  // B ve su invitación
  const invs = await getDocs(query(collection(b.db, 'invites'), where('email', '==', b.email), where('status', '==', 'pending')));
  assert.strictEqual(invs.size, 1);
  // No puede pedir un rol distinto al invitado
  await denied(updateDoc(doc(b.db, 'wallets', w.id), new FieldPath('members', b.uid), 'owner'));
  // Acepta (mismo lote que en la app)
  const batch = writeBatch(b.db);
  batch.update(doc(b.db, 'wallets', w.id), new FieldPath('members', b.uid), 'editor', new FieldPath('memberInfo', b.uid), { email: b.email }, 'updatedAt', serverTimestamp());
  batch.update(doc(b.db, 'invites', invId), { status: 'accepted', acceptedBy: b.uid, updatedAt: serverTimestamp() });
  await ok(batch.commit());
  const list = await myWallets(b);
  assert.ok(list.docs.some((d) => d.id === w.id), 'B ve el libro compartido');
  await ok(getDocs(collection(b.db, 'wallets', w.id, 'transactions')));
  await ok(tx(b, w, a.uid));
  // Editor no puede cambiar quién tiene acceso ni volver a usar la invitación
  await denied(updateDoc(doc(b.db, 'wallets', w.id), new FieldPath('members', b.uid), 'owner'));
  await ok(updateDoc(doc(b.db, 'wallets', w.id), { name: 'Casa compartida' }));
  // Salir del libro
  await ok(updateDoc(doc(b.db, 'wallets', w.id), new FieldPath('members', b.uid), deleteField(), new FieldPath('memberInfo', b.uid), deleteField()));
  await denied(getDocs(collection(b.db, 'wallets', w.id, 'transactions')));
});

test('lector: ve pero no escribe; correo sin verificar no ve invitaciones', async () => {
  const a = await newUser('a');
  const r = await newUser('r');
  const u = await newUser('u', { verified: false });
  const w = await createWallet(a);
  await ok(setDoc(doc(a.db, 'invites', `${w.id}__${r.email}`), { walletId: w.id, walletName: 'Casa', email: r.email, role: 'reader', status: 'pending', invitedBy: a.uid }));
  await ok(setDoc(doc(a.db, 'invites', `${w.id}__${u.email}`), { walletId: w.id, walletName: 'Casa', email: u.email, role: 'reader', status: 'pending', invitedBy: a.uid }));
  await denied(getDocs(query(collection(u.db, 'invites'), where('email', '==', u.email), where('status', '==', 'pending'))));
  await denied(updateDoc(doc(u.db, 'wallets', w.id), new FieldPath('members', u.uid), 'reader'));
  await ok(updateDoc(doc(r.db, 'wallets', w.id), new FieldPath('members', r.uid), 'reader', new FieldPath('memberInfo', r.uid), { email: r.email }));
  await ok(getDocs(collection(r.db, 'wallets', w.id, 'transactions')));
  await denied(tx(r, w, a.uid));
  await denied(updateDoc(doc(r.db, 'wallets', w.id), { name: 'hack' }));
  // El dueño quita el acceso
  await ok(updateDoc(doc(a.db, 'wallets', w.id), new FieldPath('members', r.uid), deleteField()));
  await denied(getDocs(collection(r.db, 'wallets', w.id, 'transactions')));
});

test('storage: sólo miembros suben y ven fotos del libro', async () => {
  const a = await newUser('a');
  const c = await newUser('c');
  const w = await createWallet(a);
  const path = `wallets/${w.id}/attachments/${a.uid}/f.jpg`;
  const img = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
  await ok(uploadString(ref(a.storage, path), img, 'data_url'));
  await ok(getBytes(ref(a.storage, path)));
  await denied(getBytes(ref(c.storage, path)));
  await denied(uploadString(ref(c.storage, `wallets/${w.id}/attachments/${c.uid}/x.jpg`), img, 'data_url'));
  // No se puede subir en la carpeta de otro ni archivos que no sean imagen/PDF
  await denied(uploadString(ref(a.storage, `wallets/${w.id}/attachments/otro/x.jpg`), img, 'data_url'));
  await denied(uploadString(ref(a.storage, `wallets/${w.id}/attachments/${a.uid}/x.txt`), 'hola', 'raw', { contentType: 'text/plain' }));
});



test('libro creado por la versión vieja de la app: se puede invitar', async () => {
  const a = await newUser('old');
  const w = doc(collection(a.db, 'wallets'));
  // Así guardaba los libros la primera versión (sin memberInfo ni currency)
  await ok(setDoc(w, { name: 'Mis finanzas', ownerId: a.uid, members: { [a.uid]: 'owner' }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  const mail = `otra${Date.now()}@gmail.com`;
  await ok(setDoc(doc(a.db, 'invites', `${w.id}__${mail}`), { walletId: w.id, walletName: 'Mis finanzas', email: mail, role: 'editor', status: 'pending', invitedBy: a.uid, invitedByName: 'Diego', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
});

test('marca de versión de reglas', async () => {
  const a = await newUser('v');
  await ok(getDoc(doc(a.db, '_rules', 'v3')));
  await denied(getDoc(doc(a.db, '_rules', 'v2')));
});
