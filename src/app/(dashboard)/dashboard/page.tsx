'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Ticket, Target, Wallet, Plus, Minus, AlertTriangle, ScanLine } from 'lucide-react';
import { useUser } from '@/firebase';
import { useWallet } from '@/components/providers/wallet-provider';
import { useNotifications } from '@/components/providers/notifications-provider';
import { useTransactionDialog } from '@/components/transactions/transaction-dialog';
import { TransactionList } from '@/components/transactions/transaction-list';
import { CheckCard } from '@/components/checks/check-card';
import { CashflowChart } from '@/components/dashboard/cashflow-chart';
import { CategoryBreakdown } from '@/components/dashboard/category-breakdown';
import { InvitesBanner, PendingRecurringCard } from '@/components/dashboard/extras';
import { useScan } from '@/components/scan/scan-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/ui-bits';
import { Skeleton } from '@/components/ui/skeleton';
import { capitalize, formatMoney } from '@/lib/format';
import { monthSpentByCategory } from '@/lib/alerts';
import { cn } from '@/lib/utils';

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function DashboardPage() {
  const { user } = useUser();
  const { transactions: allTransactions, bookTransactions: transactions, checks, budgets, categories, currency, activeWallet, isDataLoading, accounts, balances, canEdit } = useWallet();
  const { alerts } = useNotifications();
  const { openTransaction } = useTransactionDialog();
  const { scan } = useScan();

  const stats = useMemo(() => {
    const month = format(new Date(), 'yyyy-MM');
    // Saldo = suma de las cuentas en la moneda del libro (incluye saldos iniciales y transferencias)
    let balance = 0;
    for (const a of accounts) if (a.currency === currency && !a.archived) balance += balances.get(a.id) ?? 0;
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      const v = Number(t.amount) || 0;
      if (t.date?.startsWith(month)) {
        if (t.type === 'income') income += v;
        else expense += v;
      }
    }
    const pending = checks.filter((c) => c.status === 'pending');
    const toCollect = pending.filter((c) => c.type === 'toCollect').reduce((s, c) => s + c.amount, 0);
    const toPay = pending.filter((c) => c.type === 'issued').reduce((s, c) => s + c.amount, 0);
    return { balance, income, expense, toCollect, toPay, pendingCount: pending.length };
  }, [transactions, checks, accounts, balances, currency]);

  const upcoming = useMemo(() => checks.filter((c) => c.status === 'pending').slice(0, 4), [checks]);
  const spent = useMemo(() => monthSpentByCategory(transactions), [transactions]);
  const firstName = (user?.displayName || '').split(' ')[0];
  const critical = alerts.filter((a) => a.severity === 'critical');

  if (isDataLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{capitalize(format(new Date(), "EEEE d 'de' MMMM", { locale: es }))}</p>
        <h1 className="font-headline text-2xl font-extrabold sm:text-3xl">
          {greeting()}
          {firstName ? `, ${firstName}` : ''} 👋
        </h1>
      </div>

      <InvitesBanner />

      {critical.length > 0 && (
        <Link href={critical[0].href} className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-4 text-sm transition-colors hover:bg-destructive/10">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{critical[0].title}</span>
            <span className="block text-muted-foreground">{critical.length > 1 ? `y ${critical.length - 1} aviso(s) más que requieren atención` : critical[0].body}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      {/* Saldo */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1F8A76] to-[#0B3B35] p-5 text-white shadow-lg shadow-primary/20 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-[#FFD27A]/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-white/75">
              <Wallet className="h-4 w-4" /> Saldo de {activeWallet?.name}
            </p>
            <p className="tabular mt-1 font-headline text-4xl font-extrabold tracking-tight sm:text-5xl">{formatMoney(stats.balance, currency)}</p>
          </div>
          <div className={cn('grid grid-cols-3 gap-2 sm:flex', !canEdit && 'hidden')}>
            <Button onClick={() => openTransaction({ type: 'income' })} className="h-11 bg-white text-[#0B3B35] hover:bg-white/90">
              <Plus /> Ingreso
            </Button>
            <Button onClick={() => openTransaction({ type: 'expense' })} className="h-11 bg-white/15 text-white hover:bg-white/25">
              <Minus /> Gasto
            </Button>
            <Button onClick={scan} className="h-11 bg-[#FFD27A] text-[#0B3B35] hover:bg-[#FFD27A]/90">
              <ScanLine /> Escanear
            </Button>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 border-t border-white/15 pt-5">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-white/70">
              <ArrowDownLeft className="h-3.5 w-3.5" /> Entró este mes
            </p>
            <p className="tabular mt-0.5 text-lg font-bold sm:text-xl">{formatMoney(stats.income, currency)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-white/70">
              <ArrowUpRight className="h-3.5 w-3.5" /> Salió este mes
            </p>
            <p className="tabular mt-0.5 text-lg font-bold sm:text-xl">{formatMoney(stats.expense, currency)}</p>
          </div>
        </div>
      </section>

      {/* Cheques resumen */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Link href="/checks" className="rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/40">
          <p className="text-xs font-medium text-muted-foreground">Cheques a cobrar</p>
          <p className="tabular mt-1 text-lg font-bold text-income sm:text-2xl">{formatMoney(stats.toCollect, currency)}</p>
        </Link>
        <Link href="/checks" className="rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/40">
          <p className="text-xs font-medium text-muted-foreground">Cheques a pagar</p>
          <p className="tabular mt-1 text-lg font-bold sm:text-2xl">{formatMoney(stats.toPay, currency)}</p>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CashflowChart />
        </div>
        <div className="lg:col-span-2">
          <CategoryBreakdown />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Últimos movimientos</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link href="/transactions">
                Ver todos <ChevronRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-2 sm:px-3">
            {allTransactions.length ? (
              <TransactionList transactions={allTransactions.slice(0, 6)} />
            ) : (
              <EmptyState
                icon={ArrowDownLeft}
                title="Todavía no anotaste nada"
                description="Empezá cargando tu primer ingreso o gasto. Lleva segundos."
                action={<Button onClick={() => openTransaction()}><Plus /> Anotar movimiento</Button>}
                className="mx-3 mb-3"
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <PendingRecurringCard />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle>Próximos cheques</CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link href="/checks">
                  Ver <ChevronRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.length ? (
                upcoming.map((c) => <CheckCard key={c.id} check={c} compact />)
              ) : (
                <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                  <Ticket className="h-5 w-5" /> No hay cheques pendientes.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle>Presupuestos</CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link href="/budgets">
                  Ver <ChevronRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgets.length ? (
                budgets.slice(0, 4).map((b) => {
                  const used = spent.get(b.categoryId) ?? 0;
                  const pct = b.limitAmount ? used / b.limitAmount : 0;
                  const cat = categories.find((c) => c.id === b.categoryId);
                  return (
                    <div key={b.id}>
                      <div className="mb-1.5 flex justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{b.name || cat?.name}</span>
                        <span className={cn('tabular shrink-0 text-xs font-semibold', pct >= 1 ? 'text-destructive' : pct >= 0.8 ? 'text-warning' : 'text-muted-foreground')}>
                          {Math.round(pct * 100)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', pct >= 1 ? 'bg-destructive' : pct >= 0.8 ? 'bg-warning' : 'bg-primary')}
                          style={{ width: `${Math.min(100, pct * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <Link href="/budgets" className="flex items-center gap-3 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground hover:bg-muted/70">
                  <Target className="h-5 w-5" /> Poné un tope mensual a tus gastos.
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
