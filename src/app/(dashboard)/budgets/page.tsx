'use client';

import { useWalletStore } from "@/store/use-wallet-store";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, Plus, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function BudgetsPage() {
  const { activeWallet } = useWalletStore();
  const db = useFirestore();

  const budgetsQuery = useMemoFirebase(() => {
    if (!activeWallet) return null;
    return query(collection(db, "wallets", activeWallet.id, "budgets"), orderBy("createdAt", "desc"));
  }, [db, activeWallet]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!activeWallet) return null;
    return query(collection(db, "wallets", activeWallet.id, "transactions"), orderBy("date", "desc"));
  }, [db, activeWallet]);

  const { data: budgets, isLoading: isBudgetsLoading } = useCollection(budgetsQuery);
  const { data: transactions } = useCollection(transactionsQuery);
  const { data: categories } = useCollection(useMemoFirebase(() => activeWallet ? collection(db, "wallets", activeWallet.id, "categories") : null, [db, activeWallet]));

  if (!activeWallet) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">No hay un Libro activo</h2>
        <p className="text-muted-foreground">Selecciona un libro para gestionar presupuestos.</p>
      </div>
    );
  }

  const getSpentAmount = (categoryId: string) => {
    if (!transactions) return 0;
    return transactions
      .filter(t => t.categoryId === categoryId && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center text-white shrink-0">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Presupuestos</h2>
            <p className="text-muted-foreground">Controla tus límites de gasto por categoría.</p>
          </div>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Presupuesto
        </Button>
      </div>

      {isBudgetsLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : budgets && budgets.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const spent = getSpentAmount(budget.categoryId);
            const percent = Math.min((spent / budget.limitAmount) * 100, 100);
            const category = categories?.find(c => c.id === budget.categoryId);
            const isOver = spent > budget.limitAmount;

            return (
              <Card key={budget.id} className="border-none shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{budget.name}</CardTitle>
                    <Badge variant={isOver ? "destructive" : "secondary"}>
                      {category?.name || "Categoría"}
                    </Badge>
                  </div>
                  <CardDescription>Período: {budget.periodType}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gastado: ${spent.toLocaleString()}</span>
                    <span className="font-bold">Límite: ${budget.limitAmount.toLocaleString()}</span>
                  </div>
                  <Progress value={percent} className={isOver ? "bg-red-100" : ""} />
                  <p className={`text-xs text-right font-medium ${isOver ? "text-red-500" : "text-muted-foreground"}`}>
                    {isOver ? `Excedido por $${(spent - budget.limitAmount).toLocaleString()}` : `${Math.round(percent)}% utilizado`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border-2 border-dashed">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Sin presupuestos</h3>
          <p className="text-muted-foreground mb-6">Aún no has definido límites de gasto para este libro.</p>
          <Button variant="outline">Crear el primero</Button>
        </div>
      )}
    </div>
  );
}
