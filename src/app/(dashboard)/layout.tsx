'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { WalletProvider, useWallet } from '@/components/providers/wallet-provider';
import { NotificationsProvider } from '@/components/providers/notifications-provider';
import { TransactionDialogProvider } from '@/components/transactions/transaction-dialog';
import { ScanProvider } from '@/components/scan/scan-provider';
import { AppShell } from '@/components/layout/app-shell';
import { SplashScreen } from '@/components/brand/splash';
import { LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

function Gate({ children }: { children: React.ReactNode }) {
  const { isLoading, activeWallet, loadError, loadErrorCode } = useWallet();
  const auth = useAuth();
  const router = useRouter();
  if (loadError) {
    const denied = loadErrorCode === 'permission-denied';
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
        <LogoMark className="h-14 w-14" />
        <h1 className="font-headline text-xl font-bold">{denied ? 'La base de datos rechazó el acceso' : 'No pudimos cargar tus datos'}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {denied
            ? 'Faltan publicar las reglas de seguridad de Firestore en este proyecto de Firebase (Firestore → Reglas). Una vez publicadas, tocá Reintentar.'
            : 'Revisá tu conexión a internet. Si el problema sigue, cerrá sesión y volvé a entrar.'}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Reintentar</Button>
          <Button variant="outline" onClick={() => signOut(auth).then(() => router.replace('/login'))}>
            Cerrar sesión
          </Button>
        </div>
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
            <ScanProvider>
              <AppShell>{children}</AppShell>
            </ScanProvider>
          </TransactionDialogProvider>
        </NotificationsProvider>
      </Gate>
    </WalletProvider>
  );
}
