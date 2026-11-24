'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { LayoutDashboard, ArrowLeftRight, Ticket, Target, Settings, LogOut, Plus, Moon, Sun, Monitor } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { Logo, LogoMark } from '@/components/brand/logo';
import { WalletSwitcher } from './wallet-switcher';
import { NotificationBell } from './notification-bell';
import { useTransactionDialog } from '@/components/transactions/transaction-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/providers/theme-provider';
import { cn } from '@/lib/utils';

const NAV = [
  { name: 'Inicio', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Movimientos', href: '/transactions', icon: ArrowLeftRight },
  { name: 'Cheques', href: '/checks', icon: Ticket },
  { name: 'Presupuestos', href: '/budgets', icon: Target },
  { name: 'Ajustes', href: '/settings', icon: Settings },
];

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function UserMenu() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const logout = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Menú de usuario">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            initials(user?.displayName, user?.email)
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-semibold">{user?.displayName || 'Mi cuenta'}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-3 gap-1 p-1">
          {([
            ['light', Sun, 'Claro'],
            ['dark', Moon, 'Oscuro'],
            ['system', Monitor, 'Auto'],
          ] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setTheme(v)} className={cn('flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium', theme === v ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2 py-2">
          <Link href="/settings">
            <Settings className="h-4 w-4" /> Ajustes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout} className="gap-2 py-2 text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { openTransaction } = useTransactionDialog();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Barra lateral (tablet/compu) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="px-5 pb-4 pt-6">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        <div className="px-3">
          <WalletSwitcher />
        </div>
        <nav className="mt-6 flex-1 space-y-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors',
                isActive(item.href) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-3">
          <Button size="lg" className="h-12 w-full text-base" onClick={() => openTransaction()}>
            <Plus className="!size-5" /> Anotar movimiento
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Encabezado */}
        <header className="sticky top-0 z-20 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <Link href="/dashboard" className="lg:hidden" aria-label="Inicio">
              <LogoMark className="h-9 w-9" />
            </Link>
            <WalletSwitcher compact className="max-w-[55vw] lg:hidden" />
            <div className="flex-1" />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:pb-12">{children}</main>
      </div>

      {/* Navegación inferior (celular) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur-md lg:hidden" aria-label="Navegación principal">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          {NAV.slice(0, 2).map((item) => (
            <BottomLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => openTransaction()}
              className="-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95"
              aria-label="Anotar movimiento"
            >
              <Plus className="h-7 w-7" />
            </button>
          </div>
          {NAV.slice(2, 4).map((item) => (
            <BottomLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function BottomLink({ name, href, icon: Icon, active }: { name: string; href: string; icon: typeof Plus; active: boolean }) {
  return (
    <Link href={href} className={cn('flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium', active ? 'text-primary' : 'text-muted-foreground')}>
      <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-secondary')}>
        <Icon className="h-5 w-5" />
      </span>
      {name}
    </Link>
  );
}
