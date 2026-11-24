'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeftRight, Download, Plus, Search, Upload, X } from 'lucide-react';
import { ImportDialog } from '@/components/transactions/import-dialog';
import { useWallet } from '@/components/providers/wallet-provider';
import { useTransactionDialog } from '@/components/transactions/transaction-dialog';
import { TransactionList } from '@/components/transactions/transaction-list';
import { PageHeader, EmptyState, CategoryDot, Segmented } from '@/components/shared/ui-bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { capitalize, formatMoney } from '@/lib/format';
import { downloadCSV } from '@/lib/csv';

const PAGE = 60;

export default function TransactionsPage() {
  const { transactions, bookTransactions, categories, currency, activeWallet, isDataLoading, accounts, defaultAccountId, canEdit } = useWallet();
  const { openTransaction } = useTransactionDialog();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
  const [month, setMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [categoryId, setCategoryId] = useState<string>('all');
  const [limit, setLimit] = useState(PAGE);
  const [importOpen, setImportOpen] = useState(false);

  // Acceso directo desde la app instalada: /transactions?nuevo=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('nuevo')) {
      openTransaction();
      window.history.replaceState(null, '', '/transactions');
    }
  }, [openTransaction]);

  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date?.slice(0, 7)).filter(Boolean));
    set.add(format(new Date(), 'yyyy-MM'));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (type !== 'all' && t.type !== type) return false;
      if (month !== 'all' && !t.date?.startsWith(month)) return false;
      if (categoryId !== 'all' && t.categoryId !== categoryId) return false;
      if (q) {
        const cat = categories.find((c) => c.id === t.categoryId)?.name ?? '';
        const hay = `${t.description} ${t.notes ?? ''} ${cat} ${t.paymentMethod ?? ''} ${t.amount}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, categories, search, type, month, categoryId]);

  useEffect(() => setLimit(PAGE), [search, type, month, categoryId]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    const inBook = new Set(bookTransactions.map((t) => t.id));
    for (const t of filtered) {
      if (!inBook.has(t.id)) continue; // transferencias y cuentas en otra moneda no suman
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [filtered, bookTransactions]);

  const hasFilters = !!search || type !== 'all' || categoryId !== 'all';

  const exportCSV = () => {
    const rows = filtered.map((t) => [
      t.date,
      t.type === 'income' ? 'Ingreso' : t.type === 'expense' ? 'Gasto' : 'Transferencia',
      t.description,
      categories.find((c) => c.id === t.categoryId)?.name ?? '',
      accounts.find((a) => a.id === (t.accountId || defaultAccountId))?.name ?? '',
      t.paymentMethod ?? '',
      t.type === 'income' ? t.amount : -t.amount,
      t.notes ?? '',
    ]);
    const suffix = month === 'all' ? 'todos' : month;
    downloadCSV(`movimientos-${(activeWallet?.name ?? 'libro').toLowerCase().replace(/\s+/g, '-')}-${suffix}.csv`, ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Cuenta', 'Medio de pago', `Monto (${currency})`, 'Nota'], rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ArrowLeftRight}
        title="Movimientos"
        description="Todo lo que entra y sale, en orden."
        actions={
          <>
            {canEdit && (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload /> Importar
              </Button>
            )}
            <Button variant="outline" onClick={exportCSV} disabled={!filtered.length}>
              <Download /> Exportar
            </Button>
            <Button onClick={() => openTransaction()} className={canEdit ? 'hidden lg:inline-flex' : 'hidden'}>
              <Plus /> Nuevo movimiento
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar movimientos…" className="h-11 pl-10 pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Borrar búsqueda">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_180px_200px]">
            <Segmented
              className="col-span-2 sm:col-span-1"
              value={type}
              onChange={setType}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'income', label: 'Ingresos', activeClass: 'text-income' },
                { value: 'expense', label: 'Gastos', activeClass: 'text-expense' },
              ]}
            />
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {capitalize(format(parseISO(`${m}-01`), 'MMMM yyyy', { locale: es }))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <CategoryDot color={c.colorHex} /> {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: 'Ingresos', value: totals.income, cls: 'text-income' },
          { label: 'Gastos', value: totals.expense, cls: '' },
          { label: 'Diferencia', value: totals.net, cls: totals.net < 0 ? 'text-destructive' : 'text-income' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-3 sm:p-4">
            <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">{s.label}</p>
            <p className={`tabular mt-0.5 truncate text-sm font-bold sm:text-xl ${s.cls}`}>{formatMoney(s.value, currency)}</p>
          </div>
        ))}
      </div>

      {isDataLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : filtered.length ? (
        <Card>
          <CardContent className="p-2 sm:p-3">
            <TransactionList transactions={filtered.slice(0, limit)} />
            {filtered.length > limit && (
              <div className="p-3 text-center">
                <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                  Ver más ({filtered.length - limit} restantes)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={ArrowLeftRight}
          title={hasFilters || transactions.length ? 'No hay movimientos con esos filtros' : 'Todavía no anotaste movimientos'}
          description={hasFilters || transactions.length ? 'Probá cambiar el mes o borrar la búsqueda.' : 'Tocá el botón “+” para anotar tu primer ingreso o gasto.'}
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setType('all');
                  setCategoryId('all');
                }}
              >
                Limpiar filtros
              </Button>
            ) : (
              <Button onClick={() => openTransaction()}>
                <Plus /> Anotar movimiento
              </Button>
            )
          }
        />
      )}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
