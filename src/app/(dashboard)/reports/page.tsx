'use client';

import { useMemo, useState } from 'react';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart3, ChevronLeft, ChevronRight, Printer, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useWallet } from '@/components/providers/wallet-provider';
import { PageHeader, CategoryDot, Segmented } from '@/components/shared/ui-bits';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { capitalize, formatDate, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types';

const chartConfig = {
  income: { label: 'Ingresos', color: 'hsl(var(--chart-1))' },
  expense: { label: 'Gastos', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

function sum(list: Transaction[], type: 'income' | 'expense') {
  return list.filter((t) => t.type === type).reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

function Delta({ now, before, invert }: { now: number; before: number; invert?: boolean }) {
  if (!before && !now) return <span className="text-xs text-muted-foreground">—</span>;
  if (!before) return <span className="text-xs text-muted-foreground">nuevo</span>;
  const pct = ((now - before) / Math.abs(before)) * 100;
  const up = pct > 0.5;
  const down = pct < -0.5;
  // Para gastos, subir es malo (rojo); para ingresos, subir es bueno
  const good = invert ? down : up;
  const bad = invert ? up : down;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', good && 'text-income', bad && 'text-destructive', !up && !down && 'text-muted-foreground')}>
      <Icon className="h-3.5 w-3.5" />
      {up ? '+' : ''}
      {Math.round(pct)}%
    </span>
  );
}

export default function ReportsPage() {
  const { bookTransactions, categories, currency, activeWallet } = useWallet();
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [cursor, setCursor] = useState(() => new Date());

  const period = mode === 'month' ? format(cursor, 'yyyy-MM') : format(cursor, 'yyyy');
  const prevPeriod = mode === 'month' ? format(subMonths(cursor, 1), 'yyyy-MM') : String(Number(period) - 1);
  const label = mode === 'month' ? capitalize(format(cursor, 'MMMM yyyy', { locale: es })) : period;
  const prevLabel = mode === 'month' ? format(subMonths(cursor, 1), 'MMMM', { locale: es }) : prevPeriod;

  const current = useMemo(() => bookTransactions.filter((t) => t.date?.startsWith(period)), [bookTransactions, period]);
  const previous = useMemo(() => bookTransactions.filter((t) => t.date?.startsWith(prevPeriod)), [bookTransactions, prevPeriod]);

  const totals = {
    income: sum(current, 'income'),
    expense: sum(current, 'expense'),
    pIncome: sum(previous, 'income'),
    pExpense: sum(previous, 'expense'),
  };
  const net = totals.income - totals.expense;
  const savingRate = totals.income > 0 ? (net / totals.income) * 100 : null;

  const byCategory = useMemo(() => {
    const map = new Map<string, { now: number; before: number }>();
    for (const t of current) if (t.type === 'expense') map.set(t.categoryId, { now: (map.get(t.categoryId)?.now ?? 0) + t.amount, before: map.get(t.categoryId)?.before ?? 0 });
    for (const t of previous) if (t.type === 'expense') map.set(t.categoryId, { now: map.get(t.categoryId)?.now ?? 0, before: (map.get(t.categoryId)?.before ?? 0) + t.amount });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v, cat: categories.find((c) => c.id === id) }))
      .filter((r) => r.now > 0 || r.before > 0)
      .sort((a, b) => b.now - a.now);
  }, [current, previous, categories]);

  const incomeByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of current) if (t.type === 'income') map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, v, cat: categories.find((c) => c.id === id) }))
      .sort((a, b) => b.v - a.v);
  }, [current, categories]);

  const topExpenses = useMemo(() => current.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5), [current]);

  const monthly = useMemo(() => {
    if (mode !== 'year') return [];
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${period}-${String(i + 1).padStart(2, '0')}`;
      const list = current.filter((t) => t.date.startsWith(key));
      return {
        month: capitalize(format(parseISO(`${key}-01`), 'MMM', { locale: es }).replace('.', '')),
        income: sum(list, 'income'),
        expense: sum(list, 'expense'),
      };
    });
  }, [mode, period, current]);

  const move = (n: number) => setCursor((c) => (mode === 'month' ? addMonths(c, n) : new Date(c.getFullYear() + n, c.getMonth(), 1)));
  const isFuture = mode === 'month' ? format(addMonths(cursor, 1), 'yyyy-MM') > format(new Date(), 'yyyy-MM') : cursor.getFullYear() >= new Date().getFullYear();

  return (
    <div className="space-y-6 print:space-y-4">
      <PageHeader
        icon={BarChart3}
        title="Resumen"
        description="Cómo te fue en el mes o en el año, comparado con el período anterior."
        actions={
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer /> Imprimir / PDF
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Segmented
          className="sm:w-64"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'month', label: 'Mensual' },
            { value: 'year', label: 'Anual' },
          ]}
        />
        <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-1 sm:w-72">
          <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Período anterior">
            <ChevronLeft />
          </Button>
          <span className="font-headline font-bold">{label}</span>
          <Button variant="ghost" size="icon" onClick={() => move(1)} disabled={isFuture} aria-label="Período siguiente">
            <ChevronRight />
          </Button>
        </div>
      </div>

      <h2 className="hidden font-headline text-xl font-bold print:block">
        {activeWallet?.name} · {label}
      </h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ingresos</p>
          <p className="tabular text-lg font-bold text-income sm:text-2xl">{formatMoney(totals.income, currency)}</p>
          <Delta now={totals.income} before={totals.pIncome} />
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Gastos</p>
          <p className="tabular text-lg font-bold sm:text-2xl">{formatMoney(totals.expense, currency)}</p>
          <Delta now={totals.expense} before={totals.pExpense} invert />
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Resultado</p>
          <p className={cn('tabular text-lg font-bold sm:text-2xl', net < 0 ? 'text-destructive' : 'text-income')}>{formatMoney(net, currency)}</p>
          <span className="text-xs text-muted-foreground">{net >= 0 ? 'Ahorraste' : 'Gastaste de más'}</span>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ahorro sobre ingresos</p>
          <p className="tabular text-lg font-bold sm:text-2xl">{savingRate === null ? '—' : `${Math.round(savingRate)}%`}</p>
          <span className="text-xs text-muted-foreground">vs. {prevLabel}</span>
        </div>
      </div>

      {mode === 'year' && (
        <Card className="break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle>Mes a mes</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
              <BarChart data={monthly} barGap={2}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis width={52} tickLine={false} axisLine={false} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} tick={{ fontSize: 11 }} />
                <ChartTooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }} content={<ChartTooltipContent formatter={(v, n) => `${chartConfig[n as keyof typeof chartConfig]?.label}: ${formatMoney(Number(v), currency)}`} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ChartContainer>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium">Mes</th>
                    <th className="py-2 text-right font-medium">Ingresos</th>
                    <th className="py-2 text-right font-medium">Gastos</th>
                    <th className="py-2 text-right font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody className="tabular divide-y">
                  {monthly.map((m) => (
                    <tr key={m.month}>
                      <td className="py-2">{m.month}</td>
                      <td className="py-2 text-right">{formatMoney(m.income, currency)}</td>
                      <td className="py-2 text-right">{formatMoney(m.expense, currency)}</td>
                      <td className={cn('py-2 text-right font-semibold', m.income - m.expense < 0 && 'text-destructive')}>{formatMoney(m.income - m.expense, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="break-inside-avoid">
          <CardHeader className="pb-2">
            <CardTitle>Gastos por categoría</CardTitle>
            <CardDescription>Comparado con {prevLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin gastos en este período.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {byCategory.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5">
                        <span className="flex items-center gap-2">
                          <CategoryDot color={r.cat?.colorHex} /> {r.cat?.name ?? 'Sin categoría'}
                        </span>
                      </td>
                      <td className="tabular py-2.5 text-right font-semibold">{formatMoney(r.now, currency)}</td>
                      <td className="w-16 py-2.5 text-right">
                        <Delta now={r.now} before={r.before} invert />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="break-inside-avoid">
            <CardHeader className="pb-2">
              <CardTitle>Los gastos más grandes</CardTitle>
            </CardHeader>
            <CardContent>
              {topExpenses.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin gastos en este período.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {topExpenses.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{t.description}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(t.date, "d 'de' MMM")}</span>
                      </span>
                      <span className="tabular shrink-0 font-semibold">{formatMoney(t.amount, currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card className="break-inside-avoid">
            <CardHeader className="pb-2">
              <CardTitle>De dónde entró la plata</CardTitle>
            </CardHeader>
            <CardContent>
              {incomeByCategory.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin ingresos en este período.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {incomeByCategory.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <CategoryDot color={r.cat?.colorHex} /> {r.cat?.name ?? 'Sin categoría'}
                      </span>
                      <span className="tabular font-semibold text-income">{formatMoney(r.v, currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
