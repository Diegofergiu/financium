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
          <h2 className="text-3xl font-bold tracking-tight">Transactions</h2>
          <p className="text-muted-foreground">
            Monitor and manage your financial movements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <AddTransactionDialog />
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white dark:bg-card p-4 rounded-xl shadow-sm border-none">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search transactions..." 
            className="pl-9 bg-slate-50 dark:bg-muted/20 border-none ring-0" 
          />
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </div>

      <RecentTransactions />
    </div>
  )
}