'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { WalletProvider, useWallet } from '@/components/providers/wallet-provider';
import { NotificationsProvider } from '@/components/providers/notifications-provider';
import { TransactionDialogProvider } from '@/components/transactions/transaction-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { SplashScreen } from '@/components/brand/splash';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

function Gate({ children }: { children: React.ReactNode }) {
  const { isLoading, activeWallet, loadError } = useWallet();
  if (loadError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
        <LogoMark className="h-14 w-14" />
        <h1 className="font-headline text-xl font-bold">No pudimos cargar tus datos</h1>
        <p className="max-w-sm text-sm text-muted-foreground">Revisá tu conexión a internet. Si el problema sigue, cerrá sesión y volvé a entrar.</p>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    );
  }
  if (isLoading || !activeWallet) return <SplashScreen />;
  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) router.replace('/login');
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) return <SplashScreen />;

  return (
    <WalletProvider>
      <Gate>
        <NotificationsProvider>
          <TransactionDialogProvider>
            <AppShell>{children}</AppShell>
          </TransactionDialogProvider>
        </NotificationsProvider>
      </Gate>
    </WalletProvider>
  );
}
