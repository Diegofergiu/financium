import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'owner' | 'editor' | 'reader';

/** Campos de autorización desnormalizados que exigen las reglas de Firestore. */
export interface WalletAuthFields {
  walletOwnerId: string;
  walletMembersMap: Record<string, UserRole>;
}

export interface Wallet {
  id: string;
  name: string;
  ownerId: string;
  members: Record<string, UserRole>;
  currency?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type CategoryKind = 'expense' | 'income' | 'both';

export interface Category {
  id: string;
  name: string;
  colorHex: string;
  kind?: CategoryKind;
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  /** Fecha local en formato YYYY-MM-DD */
  date: string;
  description: string;
  categoryId: string;
  paymentMethod?: string;
  notes?: string;
  checkId?: string;
  createdAt?: Timestamp | null;
}

export type CheckType = 'issued' | 'toCollect';
export type CheckStatus = 'pending' | 'cleared' | 'rejected' | 'cancelled';

export interface Check {
  id: string;
  type: CheckType;
  checkNumber: string;
  bank: string;
  issuerRecipient: string;
  /** Fecha local en formato YYYY-MM-DD */
  dueDate: string;
  amount: number;
  status: CheckStatus;
  isCleared: boolean;
  clearedAt?: string | null;
  notes?: string;
  transactionId?: string | null;
  createdAt?: Timestamp | null;
}

export interface Budget {
  id: string;
  name: string;
  categoryId: string;
  limitAmount: number;
  periodType: 'monthly';
  createdAt?: Timestamp | null;
}
