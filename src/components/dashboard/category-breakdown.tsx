'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet } from '@/components/providers/wallet-provider';
import { CategoryDot } from '@/components/shared/ui-bits';
import { formatMoney } from '@/lib/format';
import { monthSpentByCategory } from '@/lib/alerts';

/** Ranking de gastos del mes por categoría (barras horizontales con nombre y monto). */
export function CategoryBreakdown() {
  const { transactions, categories, currency } = useWallet();

  const rows = useMemo(() => {
    const spent = monthSpentByCategory(transactions);
    const list = Array.from(spent.entries())
      .map(([id, amount]) => {
        const c = categories.find((x) => x.id === id);
        return { id, amount, name: c?.name ?? 'Sin categoría', color: c?.colorHex ?? '#a8a29e' };
      })
      .sort((a, b) => b.amount - a.amount);
    // Más de 6 categorías se agrupan en "Otras"
    if (list.length > 6) {
      const rest = list.slice(5).reduce((s, r) => s + r.amount, 0);
      return [...list.slice(0, 5), { id: 'other', amount: rest, name: 'Otras', color: '#a8a29e' }];
    }
    return list;
  }, [transactions, categories]);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const max = rows[0]?.amount ?? 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle>¿En qué gasté?</CardTitle>
        <CardDescription className="first-letter:uppercase">{format(new Date(), "MMMM yyyy", { locale: es })} · total {formatMoney(total, currency)}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center rounded-xl bg-muted/40 px-6 text-center text-sm text-muted-foreground">
            Todavía no hay gastos este mes.
          </div>
        ) : (
          <ul className="space-y-3.5">
            {rows.map((r) => (
              <li key={r.id} title={`${r.name}: ${formatMoney(r.amount, currency)}`}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <CategoryDot color={r.color} />
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="tabular shrink-0 font-semibold">
                    {formatMoney(r.amount, currency)}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">{Math.round((r.amount / total) * 100)}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(3, (r.amount / max) * 100)}%`, backgroundColor: r.color }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
