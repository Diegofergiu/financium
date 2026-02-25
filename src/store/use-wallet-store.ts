import { create } from 'zustand';
import { Wallet } from '@/types';

interface WalletState {
  activeWallet: Wallet | null;
  setActiveWallet: (wallet: Wallet | null) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  activeWallet: null,
  setActiveWallet: (wallet) => set({ activeWallet: wallet }),
}));