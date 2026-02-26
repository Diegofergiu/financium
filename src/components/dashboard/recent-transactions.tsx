"use client"

import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, CreditCard, ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react"
import { useWalletStore } from "@/store/use-wallet-store"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit } from "firebase/firestore"

export function RecentTransactions() {
  const [mounted, setMounted] = useState(false)
  const { activeWallet } = useWalletStore()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const transactionsQuery = useMemoFirebase(() => {
    if (!activeWallet) return null;
    return query(
      collection(db, "wallets", activeWallet.id, "transactions"),
      orderBy("date", "desc"),
      limit(10)
    );
  }, [db, activeWallet]);

  const { data: transactions, isLoading } = useCollection(transactionsQuery);
  const { data: categories } = useCollection(useMemoFirebase(() => activeWallet ? collection(db, "wallets", activeWallet.id, "categories") : null, [db, activeWallet]));

  return (
    <Card className="border-none shadow-sm bg-white dark:bg-card">
      <CardHeader>
        <CardTitle>Transacciones Recientes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : transactions && transactions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[200px] md:w-[300px]">Descripción</TableHead>
                <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                <TableHead className="hidden md:table-cell">Método</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => {
                const category = categories?.find(c => c.id === t.categoryId);
                const isExpense = t.type === 'expense';
                
                return (
                  <TableRow key={t.id} className="group border-slate-50 dark:border-muted">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isExpense ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                          {isExpense ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold truncate max-w-[120px] md:max-w-none">{t.description}</p>
                          <p className="text-[10px] text-muted-foreground">{t.date}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary" className="font-normal">{category?.name || "Sin categoría"}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{t.paymentMethod}</TableCell>
                    <TableCell className={`text-right font-bold ${isExpense ? "text-slate-900 dark:text-white" : "text-green-600"}`}>
                      {isExpense ? "-" : "+"}${mounted 
                        ? t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })
                        : t.amount.toFixed(2)
                      }
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground italic">No hay transacciones registradas.</div>
        )}
      </CardContent>
    </Card>
  )
}
