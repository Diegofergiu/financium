import { StatsGrid } from "@/components/dashboard/stats-grid"
import { CashflowChart } from "@/components/dashboard/cashflow-chart"
import { CheckAlerts } from "@/components/dashboard/check-alerts"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { Button } from "@/components/ui/button"
import { Plus, Download } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome back. Here is what is happening with your accounts today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            New Transaction
          </Button>
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
             <h3 className="font-bold text-lg mb-2">Smart Insights</h3>
             <p className="text-sm opacity-90 leading-relaxed">
               Your spending on <strong>"Groceries"</strong> is 15% higher than usual this week. 
               Consider setting a budget for better control.
             </p>
             <Button variant="outline" size="sm" className="mt-4 bg-white/20 border-white/40 hover:bg-white/30 text-white">
                Set Budget
             </Button>
          </div>
        </div>
      </div>
    </div>
  )
}