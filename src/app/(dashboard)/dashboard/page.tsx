'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { CheckAlerts } from "@/components/dashboard/check-alerts";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { Button } from "@/components/ui/button";
import { Plus, Download, AlertCircle } from "lucide-react";
import { useWalletStore } from "@/store/use-wallet-store";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";

export default function DashboardPage() {
  const { activeWallet } = useWalletStore();

  if (!activeWallet) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">No hay un Libro activo</h2>
        <p className="text-muted-foreground">Crea o selecciona un libro en el menú lateral para ver tus datos.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Panel Principal</h2>
          <p className="text-muted-foreground">
            Bienvenido de nuevo. Estas son tus estadísticas para <strong>{activeWallet.name}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <AddTransactionDialog />
        </div>
      </div>

      <StatsGrid />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="md:col-span-1 lg:col-span-4 h-full">
           <CashflowChart />
        </div>
        <div className="md:col-span-1 lg:col-span-3 h-full">
           <CheckAlerts />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-7">
        <div className="lg:col-span-5">
           <RecentTransactions />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 bg-secondary rounded-xl text-secondary-foreground shadow-sm">
             <h3 className="font-bold text-lg mb-2">IA Sugiere</h3>
             <p className="text-sm opacity-90 leading-relaxed">
               ¿Sabías que puedes usar la IA para categorizar automáticamente tus transacciones al subirlas?
             </p>
             <Button variant="outline" size="sm" className="mt-4 bg-white/20 border-white/40 hover:bg-white/30 text-white w-full">
                Saber más
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
