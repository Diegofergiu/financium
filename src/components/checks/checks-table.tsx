import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, FileText, CalendarClock } from "lucide-react"

const checks = [
  { id: "1", number: "CH-9923", bank: "Chase", party: "Office Rental Inc.", amount: 1500, dueDate: "2024-06-20", status: "pending", type: "issued" },
  { id: "2", number: "CH-1044", bank: "Wells Fargo", party: "Project Phoenix", amount: 4500, dueDate: "2024-06-18", status: "pending", type: "collectible" },
  { id: "3", number: "CH-8821", bank: "Bank of America", party: "Electric Co.", amount: 450, dueDate: "2024-06-12", status: "cleared", type: "issued" },
  { id: "4", number: "CH-2290", bank: "Chase", party: "Acme Corp", amount: 200, dueDate: "2024-06-30", status: "cancelled", type: "collectible" },
]

export function ChecksTable() {
  return (
    <div className="bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden border-none">
      <Table>
        <TableHeader className="bg-slate-50 dark:bg-muted/20">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Check No.</TableHead>
            <TableHead>Bank</TableHead>
            <TableHead>Recipient / Payer</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checks.map((check) => (
            <TableRow key={check.id} className="border-slate-50 dark:border-muted">
              <TableCell>
                <Checkbox checked={check.status === 'cleared'} />
              </TableCell>
              <TableCell className="font-mono text-xs font-semibold">{check.number}</TableCell>
              <TableCell>{check.bank}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{check.party}</span>
                  <Badge variant="outline" className="w-fit text-[10px] h-4 mt-1">
                    {check.type === 'issued' ? 'Issued' : 'To Collect'}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {check.dueDate}
                </div>
              </TableCell>
              <TableCell className="font-bold">${check.amount.toLocaleString()}</TableCell>
              <TableCell>
                <Badge 
                  variant={
                    check.status === 'cleared' ? 'default' : 
                    check.status === 'pending' ? 'secondary' : 'destructive'
                  }
                  className="capitalize text-[10px]"
                >
                  {check.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon">
                   <MoreHorizontal className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}