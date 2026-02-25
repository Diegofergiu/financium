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
import { ArrowUpRight, ArrowDownRight, Coffee, ShoppingCart, Zap, CreditCard } from "lucide-react"

const transactions = [
  {
    id: "1",
    description: "Starbucks Coffee",
    category: "Food & Drink",
    amount: -12.50,
    date: "2024-06-15",
    method: "Debit Card",
    icon: Coffee,
    color: "bg-orange-100 text-orange-600"
  },
  {
    id: "2",
    description: "Stripe Payout",
    category: "Income",
    amount: 1250.00,
    date: "2024-06-14",
    method: "Transfer",
    icon: CreditCard,
    color: "bg-green-100 text-green-600"
  },
  {
    id: "3",
    description: "Whole Foods",
    category: "Groceries",
    amount: -156.20,
    date: "2024-06-14",
    method: "Amex",
    icon: ShoppingCart,
    color: "bg-blue-100 text-blue-600"
  },
  {
    id: "4",
    description: "Internet Bill",
    category: "Utilities",
    amount: -85.00,
    date: "2024-06-12",
    method: "Auto-pay",
    icon: Zap,
    color: "bg-purple-100 text-purple-600"
  }
]

export function RecentTransactions() {
  return (
    <Card className="border-none shadow-sm bg-white dark:bg-card">
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="w-[300px]">Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id} className="group border-slate-50 dark:border-muted">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.color}`}>
                      <t.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.description}</p>
                      <p className="text-[10px] text-muted-foreground">{t.date}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">{t.category}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{t.method}</TableCell>
                <TableCell className={`text-right font-bold ${t.amount < 0 ? "text-slate-900 dark:text-white" : "text-green-600"}`}>
                  {t.amount < 0 ? "" : "+"}${Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}