'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  collection,
  doc,
  FieldPath,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, listAll, ref as storageRef } from 'firebase/storage';
import { getFirebaseStorage, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Account, Budget, Category, Check, Invite, Recurring, Transaction, UserRole, Wallet, WalletAuthFields } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/defaults';
import { DEFAULT_CURRENCY } from '@/lib/format';
import { accountBalances, bookTransactions, DEFAULT_ACCOUNTS } from '@/lib/finance';
import { dueRecurring, recurringTransactionId } from '@/lib/recurring';

const SUBCOLLECTIONS = ['categories', 'transactions', 'checks', 'budgets', 'accounts', 'recurring', 'paymentMethods', 'members'] as const;
const ROLES: UserRole[] = ['owner', 'editor', 'reader'];

export const inviteId = (walletId: string, email: string) => `${walletId}__${email.trim().toLowerCase()}`;

interface WalletContextValue {
  wallets: Wallet[];
  activeWallet: Wallet | null;
  setActiveWalletId: (id: string) => void;
  isLoading: boolean;
  loadError: boolean;
  /** Código del error al cargar los libros (p. ej. 'permission-denied'). */
  loadErrorCode: string | null;
  role: UserRole | null;
  canEdit: boolean;
  isOwner: boolean;
  categories: Category[];
  /** Todos los movimientos, incluidas transferencias y cuentas en otra moneda. */
  transactions: Transaction[];
  /** Sólo ingresos/gastos en la moneda del libro (para totales, gráficos y presupuestos). */
  bookTransactions: Transaction[];
  checks: Check[];
  budgets: Budget[];
  accounts: Account[];
  defaultAccountId: string | null;
  balances: Map<string, number>;
  recurring: Recurring[];
  invites: Invite[];
  isDataLoading: boolean;
  currency: string;
  /** Campos que cada documento del libro debe llevar para cumplir las reglas de seguridad. */
  authFields: WalletAuthFields | null;
  createWallet: (name: string, currency?: string) => Promise<string>;
  deleteWallet: (walletId: string) => Promise<void>;
  acceptInvite: (invite: Invite) => Promise<void>;
  declineInvite: (invite: Invite) => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const millis = (v: any) => (v && typeof v.toMillis === 'function' ? v.toMillis() : 0);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const db = useFirestore();
  const storageKey = user ? `mibolsillo:active-wallet:${user.uid}` : null;

  const [activeId, setActiveId] = useState<string | null>(null);
  const creatingDefault = useRef(false);
  const profileSynced = useRef(false);
  const accountsEnsured = useRef(new Set<string>());
  const recurringProcessed = useRef(new Set<string>());

  useEffect(() => {
    if (!storageKey) return;
    try {
      setActiveId(window.localStorage.getItem(storageKey));
    } catch {}
  }, [storageKey]);

  // Asegura que exista el perfil del usuario (cuentas creadas antes no lo tenían)
  useEffect(() => {
    if (!user || profileSynced.current) return;
    profileSynced.current = true;
    setDoc(
      doc(db, 'users', user.uid),
      {
        id: user.uid,
        email: user.email ?? '',
        ...(user.displayName ? { displayName: user.displayName } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((e) => console.warn('No se pudo sincronizar el perfil', e));
  }, [db, user]);

  // Libros propios y compartidos: el dueño también figura en members como 'owner'
  const walletsQuery = useMemoFirebase(
    () => (user ? query(collection(db, 'wallets'), where(new FieldPath('members', user.uid), 'in', ROLES)) : null),
    [db, user]
  );
  const { data: walletsRaw, error: walletsError } = useCollection<Omit<Wallet, 'id'>>(walletsQuery);

  const wallets = useMemo(
    () => (walletsRaw ?? []).slice().sort((a, b) => millis(a.createdAt) - millis(b.createdAt)) as Wallet[],
    [walletsRaw]
  );

  const activeWallet = useMemo(() => wallets.find((w) => w.id === activeId) ?? wallets[0] ?? null, [wallets, activeId]);
  const role: UserRole | null = activeWallet && user ? (activeWallet.ownerId === user.uid ? 'owner' : activeWallet.members?.[user.uid] ?? null) : null;
  const canEdit = role === 'owner' || role === 'editor';

  const setActiveWalletId = useCallback(
    (id: string) => {
      setActiveId(id);
      try {
        if (storageKey) window.localStorage.setItem(storageKey, id);
      } catch {}
    },
    [storageKey]
  );

  const createWallet = useCallback(
    async (name: string, currency: string = DEFAULT_CURRENCY) => {
      if (!user) throw new Error('Sin sesión');
      const members = { [user.uid]: 'owner' as const };
      const walletRef = doc(collection(db, 'wallets'));
      const batch = writeBatch(db);
      const auth = { walletOwnerId: user.uid, walletMembersMap: members, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      batch.set(walletRef, {
        name: name.trim(),
        ownerId: user.uid,
        members,
        memberInfo: { [user.uid]: { email: user.email ?? '', name: user.displayName ?? '' } },
        currency,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      for (const cat of DEFAULT_CATEGORIES) batch.set(doc(collection(db, 'wallets', walletRef.id, 'categories')), { ...cat, ...auth });
      for (const acc of DEFAULT_ACCOUNTS) batch.set(doc(collection(db, 'wallets', walletRef.id, 'accounts')), { ...acc, currency, ...auth });
      await batch.commit();
      setActiveWalletId(walletRef.id);
      return walletRef.id;
    },
    [db, user, setActiveWalletId]
  );

  const deleteWallet = useCallback(
    async (walletId: string) => {
      const refs = [] as ReturnType<typeof doc>[];
      for (const sub of SUBCOLLECTIONS) {
        const snap = await getDocs(collection(db, 'wallets', walletId, sub));
        snap.forEach((d) => refs.push(d.ref));
      }
      for (let i = 0; i < refs.length; i += 400) {
        const batch = writeBatch(db);
        refs.slice(i, i + 400).forEach((r) => batch.delete(r));
        await batch.commit();
      }
      // Fotos adjuntas
      try {
        const storage = getFirebaseStorage();
        const walk = async (path: string): Promise<void> => {
          const res = await listAll(storageRef(storage, path));
          await Promise.all(res.items.map((i) => deleteObject(i).catch(() => {})));
          await Promise.all(res.prefixes.map((p) => walk(p.fullPath)));
        };
        await walk(`wallets/${walletId}`);
      } catch (e) {
        console.warn('No se pudieron borrar algunas fotos', e);
      }
      const batch = writeBatch(db);
      batch.delete(doc(db, 'wallets', walletId));
      await batch.commit();
    },
    [db]
  );

  // Primer ingreso: crear un libro por defecto con categorías y cuentas listas para usar
  useEffect(() => {
    if (!user || walletsRaw === null || walletsError) return;
    if (walletsRaw.length === 0 && !creatingDefault.current) {
      creatingDefault.current = true;
      createWallet('Mis finanzas').catch((e) => {
        console.error(e);
        creatingDefault.current = false;
      });
    }
  }, [user, walletsRaw, walletsError, createWallet]);

  const wid = activeWallet?.id;
  const sub = (name: string) => (wid ? collection(db, 'wallets', wid, name) : null);
  const categoriesRef = useMemoFirebase(() => sub('categories'), [db, wid]);
  const transactionsRef = useMemoFirebase(() => sub('transactions'), [db, wid]);
  const checksRef = useMemoFirebase(() => sub('checks'), [db, wid]);
  const budgetsRef = useMemoFirebase(() => sub('budgets'), [db, wid]);
  const accountsRef = useMemoFirebase(() => sub('accounts'), [db, wid]);
  const recurringRef = useMemoFirebase(() => sub('recurring'), [db, wid]);
  const email = user?.email?.toLowerCase() ?? '';
  const invitesRef = useMemoFirebase(
    () => (email && user?.emailVerified ? query(collection(db, 'invites'), where('email', '==', email), where('status', '==', 'pending')) : null),
    [db, email, user?.emailVerified]
  );

  const cats = useCollection<Omit<Category, 'id'>>(categoriesRef);
  const txs = useCollection<Omit<Transaction, 'id'>>(transactionsRef);
  const chks = useCollection<Omit<Check, 'id'>>(checksRef);
  const bdgs = useCollection<Omit<Budget, 'id'>>(budgetsRef);
  const accs = useCollection<Omit<Account, 'id'>>(accountsRef);
  const recs = useCollection<Omit<Recurring, 'id'>>(recurringRef);
  const invs = useCollection<Omit<Invite, 'id'>>(invitesRef);

  const currency = activeWallet?.currency || DEFAULT_CURRENCY;

  const categories = useMemo(() => ((cats.data ?? []) as Category[]).slice().sort((a, b) => a.name.localeCompare(b.name, 'es')), [cats.data]);
  const transactions = useMemo(
    () =>
      ((txs.data ?? []) as Transaction[])
        .slice()
        .sort((a, b) => (a.date === b.date ? millis(b.createdAt) - millis(a.createdAt) : a.date < b.date ? 1 : -1)),
    [txs.data]
  );
  const checks = useMemo(
    () => ((chks.data ?? []) as Check[]).slice().sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0)),
    [chks.data]
  );
  const budgets = useMemo(() => ((bdgs.data ?? []) as Budget[]).slice().sort((a, b) => a.name.localeCompare(b.name, 'es')), [bdgs.data]);
  const accounts = useMemo(
    () =>
      ((accs.data ?? []) as Account[])
        .map((a) => ({ ...a, currency: a.currency || currency }))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'es')),
    [accs.data, currency]
  );
  const defaultAccountId = accounts.find((a) => !a.archived)?.id ?? null;
  const recurring = useMemo(() => ((recs.data ?? []) as Recurring[]).slice().sort((a, b) => a.dayOfMonth - b.dayOfMonth), [recs.data]);
  const invites = useMemo(() => (invs.data ?? []) as Invite[], [invs.data]);

  const bookTx = useMemo(() => bookTransactions(transactions, accounts, defaultAccountId, currency), [transactions, accounts, defaultAccountId, currency]);
  const balances = useMemo(() => accountBalances(accounts, transactions, defaultAccountId), [accounts, transactions, defaultAccountId]);

  const authFields = useMemo<WalletAuthFields | null>(
    () => (activeWallet ? { walletOwnerId: activeWallet.ownerId, walletMembersMap: activeWallet.members ?? {} } : null),
    [activeWallet]
  );

  // Libros creados antes de existir las cuentas: se les crea "Efectivo"
  useEffect(() => {
    if (!wid || !canEdit || !authFields || accs.data === null || accs.data.length > 0 || accountsEnsured.current.has(wid)) return;
    accountsEnsured.current.add(wid);
    setDoc(doc(collection(db, 'wallets', wid, 'accounts')), {
      ...DEFAULT_ACCOUNTS[0],
      currency,
      ...authFields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch((e) => console.warn('No se pudo crear la cuenta principal', e));
  }, [db, wid, canEdit, authFields, accs.data, currency]);

  // Gastos fijos con "anotar solo": se crean al abrir la app (y también desde el servidor).
  // El id del movimiento es fijo por mes, así que nunca se duplica.
  useEffect(() => {
    if (!wid || !canEdit || !authFields || recs.data === null) return;
    const due = dueRecurring(recurring).filter((r) => r.autoCreate && !recurringProcessed.current.has(`${r.id}-${r.month}`));
    if (!due.length) return;
    const batch = writeBatch(db);
    for (const r of due) {
      recurringProcessed.current.add(`${r.id}-${r.month}`);
      batch.set(doc(db, 'wallets', wid, 'transactions', recurringTransactionId(r.id, r.month)), {
        walletId: wid,
        type: r.type,
        amount: r.amount,
        description: r.description,
        categoryId: r.categoryId,
        paymentMethod: r.paymentMethod ?? '',
        accountId: r.accountId ?? '',
        notes: 'Gasto fijo anotado automáticamente',
        date: r.date,
        recurringId: r.id,
        ...authFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'wallets', wid, 'recurring', r.id), { lastCreatedMonth: r.month, updatedAt: serverTimestamp() });
    }
    batch.commit().catch((e) => console.warn('No se pudieron anotar los gastos fijos', e));
  }, [db, wid, canEdit, authFields, recs.data, recurring]);

  const acceptInvite = useCallback(
    async (invite: Invite) => {
      if (!user) return;
      const batch = writeBatch(db);
      batch.update(
        doc(db, 'wallets', invite.walletId),
        new FieldPath('members', user.uid),
        invite.role,
        new FieldPath('memberInfo', user.uid),
        { email: user.email ?? '', name: user.displayName ?? '' },
        'updatedAt',
        serverTimestamp()
      );
      batch.update(doc(db, 'invites', invite.id), { status: 'accepted', acceptedBy: user.uid, updatedAt: serverTimestamp() });
      await batch.commit();
      setActiveWalletId(invite.walletId);
    },
    [db, user, setActiveWalletId]
  );

  const declineInvite = useCallback(
    async (invite: Invite) => {
      await updateDoc(doc(db, 'invites', invite.id), { status: 'declined', updatedAt: serverTimestamp() });
    },
    [db]
  );

  const value: WalletContextValue = {
    wallets,
    activeWallet,
    setActiveWalletId,
    isLoading: !!user && walletsRaw === null && !walletsError,
    loadError: !!walletsError,
    loadErrorCode: (walletsError as any)?.code ?? null,
    role,
    canEdit,
    isOwner: role === 'owner',
    categories,
    transactions,
    bookTransactions: bookTx,
    checks,
    budgets,
    accounts,
    defaultAccountId,
    balances,
    recurring,
    invites,
    isDataLoading: !!wid && (txs.data === null || cats.data === null || chks.data === null || bdgs.data === null) && !txs.error,
    currency,
    authFields,
    createWallet,
    deleteWallet,
    acceptInvite,
    declineInvite,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet debe usarse dentro de WalletProvider');
  return ctx;
}

