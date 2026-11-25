import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'owner' | 'editor' | 'reader';

/** Campos de autorización desnormalizados que exigen las reglas de Firestore. */
export interface WalletAuthFields {
  walletOwnerId: string;
  walletMembersMap: Record<string, UserRole>;
}

export interface MemberInfo {
  email: string;
  name?: string;
}

export interface Wallet {
  id: string;
  name: string;
  ownerId: string;
  members: Record<string, UserRole>;
  memberInfo?: Record<string, MemberInfo>;
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

export type TransactionType = 'income' | 'expense' | 'transfer';

/** Foto o PDF adjunto (factura, boleta, cheque) guardado en Firebase Storage. */
export interface Attachment {
  path: string;
  url: string;
  name: string;
  contentType: string;
  size: number;
}

export type AccountKind = 'cash' | 'bank' | 'wallet' | 'savings' | 'card';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  currency: string;
  initialBalance: number;
  colorHex: string;
  order?: number;
  archived?: boolean;
}

export interface Recurring {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  categoryId: string;
  paymentMethod?: string;
  accountId?: string;
  /** Día del mes (1-31; si el mes es más corto se usa el último día). */
  dayOfMonth: number;
  /** true: se anota solo ese día. false: sólo recuerda y se anota con un toque. */
  autoCreate: boolean;
  active: boolean;
  lastCreatedMonth?: string | null;
}

export interface Invite {
  id: string;
  walletId: string;
  walletName: string;
  email: string;
  role: Exclude<UserRole, 'owner'>;
  invitedBy: string;
  invitedByName: string;
  status: 'pending' | 'accepted' | 'declined';
}

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
  recurringId?: string;
  accountId?: string;
  /** Sólo transferencias: cuenta destino y monto recibido (si la moneda es distinta). */
  toAccountId?: string;
  toAmount?: number;
  attachments?: Attachment[];
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
  accountId?: string;
  attachments?: Attachment[];
  /** Avisos propios de este cheque (días antes). null/ausente = usar la configuración general. */
  reminderDays?: number[] | null;
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
