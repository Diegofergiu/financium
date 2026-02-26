"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Loader2 } from "lucide-react"
import { useWalletStore } from "@/store/use-wallet-store"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where } from "firebase/firestore"
import { startOfMonth, endOfMonth, format } from "date-fns"

export function StatsGrid() {
  const [mounted, setMounted] = useState(false)
  const { activeWallet } = useWalletStore()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const transactionsQuery = useMemoFirebase(() => {
    if (!activeWallet) return null;
    return collection(db, "wallets", activeWallet.id, "transactions");
  }, [db, activeWallet]);

  const { data: transactions, isLoading } = useCollection(transactionsQuery);

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="h-32 flex items-center justify-center">
             <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </Card>
        ))}
      </div>
    );
  }

  const now = new Date();
  const start = format(startOfMonth(now), 'yyyy-MM-dd');
  const end = format(endOfMonth(now), 'yyyy-MM-dd');

  const totalBalance = transactions?.reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, 0) || 0;
  const monthlyIncome = transactions?.filter(t => t.type === 'income' && t.date >= start && t.date <= end).reduce((sum, t) => sum + t.amount, 0) || 0;
  const monthlyExpense = transactions?.filter(t => t.type === 'expense' && t.date >= start && t.date <= end).reduce((sum, t) => sum + t.amount, 0) || 0;
  
  const stats = [
    {
      title: "Balance Total",
      value: `$${totalBalance.toLocaleString()}`,
      description: "Fondos totales en este libro",
      icon: Wallet,
      trend: "Actualizado",
      trendColor: "text-green-600",
    },
    {
      title: "Ingresos del Mes",
      value: `$${monthlyIncome.toLocaleString()}`,
      description: "Total acumulado este mes",
      icon: ArrowUpRight,
      trend: "Dinero entrante",
      trendColor: "text-blue-600",
    },
    {
      title: "Gastos del Mes",
      value: `$${monthlyExpense.toLocaleString()}`,
      description: "Total ejecutado este mes",
      icon: ArrowDownRight,
      trend: "Dinero saliente",
      trendColor: "text-red-600",
    },
    {
      title: "Margen Neto",
      value: `$${(monthlyIncome - monthlyExpense).toLocaleString()}`,
      description: "Diferencia ingresos/gastos",
      icon: TrendingUp,
      trend: monthlyIncome >= monthlyExpense ? "Superávit" : "Déficit",
      trendColor: monthlyIncome >= monthlyExpense ? "text-green-600" : "text-red-600",
    },
  ]

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="shadow-sm border-none bg-white dark:bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center dark:bg-muted/20">
              <stat.icon className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
            <div className={`text-[10px] mt-2 font-semibold ${stat.trendColor}`}>
              {stat.trend}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
