export type UserRole = 'owner' | 'editor' | 'reader';

export interface WalletMember {
  uid: string;
  email: string;
  role: UserRole;
}

export interface Wallet {
  id: string;
  name: string;
  ownerId: string;
  members: WalletMember[];
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  color: string; // Hex code
  icon?: string;
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  walletId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  categoryId: string;
  description: string;
  type: TransactionType;
  paymentMethod: string;
  attachmentUrl?: string;
  createdAt: number;
}

export type CheckStatus = 'pending' | 'cleared' | 'cancelled';
export type CheckType = 'issued' | 'collectible';

export interface Check {
  id: string;
  walletId: string;
  number: string;
  bank: string;
  partyName: string; // Issuer or Recipient
  dueDate: string;
  amount: number;
  status: CheckStatus;
  type: CheckType;
  attachmentUrl?: string;
  createdAt: number;
}

export interface Budget {
  id: string;
  walletId: string;
  categoryId: string;
  limit: number;
  period: 'monthly';
}