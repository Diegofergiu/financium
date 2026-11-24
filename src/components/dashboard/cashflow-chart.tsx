'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useWallet } from '@/components/providers/wallet-provider';
import { capitalize, formatMoney } from '@/lib/format';

const chartConfig = {
  income: { label: 'Ingresos', color: 'hsl(var(--chart-1))' },
  expense: { label: 'Gastos', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

export function CashflowChart() {
  const { transactions, currency } = useWallet();

  const data = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
    return months.map((m) => {
      const key = format(m, 'yyyy-MM');
      let income = 0;
      let expense = 0;
      for (const t of transactions) {
        if (!t.date?.startsWith(key)) continue;
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      }
      return { month: capitalize(format(m, 'MMM', { locale: es }).replace('.', '')), full: capitalize(format(m, 'MMMM yyyy', { locale: es })), income, expense };
    });
  }, [transactions]);

  const hasData = data.some((d) => d.income || d.expense);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>Ingresos y gastos</CardTitle>
        <CardDescription>Últimos 6 meses</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
            <BarChart data={data} barGap={2} margin={{ left: 0, right: 0, top: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.5} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                width={52}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatMoney(v, currency, { compact: true })}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, p) => p?.[0]?.payload?.full}
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `var(--color-${name})` }} />
                          {chartConfig[name as keyof typeof chartConfig]?.label}
                        </span>
                        <span className="tabular font-semibold text-foreground">{formatMoney(Number(value), currency)}</span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[240px] items-center justify-center rounded-xl bg-muted/40 text-center text-sm text-muted-foreground">
            Cuando anotes movimientos, acá vas a ver la evolución mes a mes.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
