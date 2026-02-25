import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog"
import { Input } from "@/components/ui/input"
import { Search, Filter, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function TransactionsPage() {
  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Transacciones</h2>
          <p className="text-muted-foreground">
            Monitorea y gestiona tus movimientos financieros.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <AddTransactionDialog />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-card p-4 rounded-xl shadow-sm border-none">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar transacciones..." 
            className="pl-9 bg-slate-50 dark:bg-muted/20 border-none ring-0 w-full" 
          />
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground w-full sm:w-auto">
          <Filter className="mr-2 h-4 w-4" />
          Filtros
        </Button>
      </div>

      <RecentTransactions />
    </div>
  )
}
