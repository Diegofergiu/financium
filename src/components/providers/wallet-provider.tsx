'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Budget, Category, Check, Transaction, Wallet, WalletAuthFields } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/defaults';
import { DEFAULT_CURRENCY } from '@/lib/format';

const SUBCOLLECTIONS = ['categories', 'transactions', 'checks', 'budgets', 'paymentMethods', 'members'] as const;

interface WalletContextValue {
  wallets: Wallet[];
  activeWallet: Wallet | null;
  setActiveWalletId: (id: string) => void;
  isLoading: boolean;
  loadError: boolean;
  categories: Category[];
  transactions: Transaction[];
  checks: Check[];
  budgets: Budget[];
  isDataLoading: boolean;
  currency: string;
  /** Campos que cada documento del libro debe llevar para cumplir las reglas de seguridad. */
  authFields: WalletAuthFields | null;
  createWallet: (name: string, currency?: string) => Promise<string>;
  deleteWallet: (walletId: string) => Promise<void>;
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

  // Recuperar el último libro usado en este dispositivo
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

  // Sin orderBy para no requerir índices compuestos: se ordena en el cliente
  const walletsQuery = useMemoFirebase(
    () => (user ? query(collection(db, 'wallets'), where('ownerId', '==', user.uid)) : null),
    [db, user]
  );
  const { data: walletsRaw, error: walletsError } = useCollection<Omit<Wallet, 'id'>>(walletsQuery);

  const wallets = useMemo(
    () => (walletsRaw ?? []).slice().sort((a, b) => millis(a.createdAt) - millis(b.createdAt)) as Wallet[],
    [walletsRaw]
  );

  const activeWallet = useMemo(
    () => wallets.find((w) => w.id === activeId) ?? wallets[0] ?? null,
    [wallets, activeId]
  );

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
      batch.set(walletRef, {
        name: name.trim(),
        ownerId: user.uid,
        members,
        currency,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      for (const cat of DEFAULT_CATEGORIES) {
        batch.set(doc(collection(db, 'wallets', walletRef.id, 'categories')), {
          ...cat,
          walletOwnerId: user.uid,
          walletMembersMap: members,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
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
      const batch = writeBatch(db);
      batch.delete(doc(db, 'wallets', walletId));
      await batch.commit();
    },
    [db]
  );

  // Primer ingreso: crear un libro por defecto con categorías listas para usar
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

  const cats = useCollection<Omit<Category, 'id'>>(categoriesRef);
  const txs = useCollection<Omit<Transaction, 'id'>>(transactionsRef);
  const chks = useCollection<Omit<Check, 'id'>>(checksRef);
  const bdgs = useCollection<Omit<Budget, 'id'>>(budgetsRef);

  const categories = useMemo(
    () => ((cats.data ?? []) as Category[]).slice().sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [cats.data]
  );
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
  const budgets = useMemo(
    () => ((bdgs.data ?? []) as Budget[]).slice().sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [bdgs.data]
  );

  const authFields = useMemo<WalletAuthFields | null>(
    () => (activeWallet ? { walletOwnerId: activeWallet.ownerId, walletMembersMap: activeWallet.members ?? {} } : null),
    [activeWallet]
  );

  const value: WalletContextValue = {
    wallets,
    activeWallet,
    setActiveWalletId,
    isLoading: !!user && walletsRaw === null && !walletsError,
    loadError: !!walletsError,
    categories,
    transactions,
    checks,
    budgets,
    isDataLoading: !!wid && (txs.data === null || cats.data === null || chks.data === null || bdgs.data === null) && !txs.error,
    currency: activeWallet?.currency || DEFAULT_CURRENCY,
    authFields,
    createWallet,
    deleteWallet,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet debe usarse dentro de WalletProvider');
  return ctx;
}
