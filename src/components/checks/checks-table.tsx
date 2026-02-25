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
import { MoreHorizontal, CalendarClock } from "lucide-react"

const checks = [
  { id: "1", number: "CH-9923", bank: "Chase", party: "Alquiler S.A.", amount: 1500, dueDate: "2024-06-20", status: "pending", type: "issued" },
  { id: "2", number: "CH-1044", bank: "Wells Fargo", party: "Proyecto Phoenix", amount: 4500, dueDate: "2024-06-18", status: "pending", type: "collectible" },
  { id: "3", number: "CH-8821", bank: "Bank of America", party: "Electricidad", amount: 450, dueDate: "2024-06-12", status: "cleared", type: "issued" },
  { id: "4", number: "CH-2290", bank: "Chase", party: "Acme Corp", amount: 200, dueDate: "2024-06-30", status: "cancelled", type: "collectible" },
]

export function ChecksTable() {
  return (
    <div className="bg-white dark:bg-card rounded-xl shadow-sm overflow-hidden border-none">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-muted/20">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px] md:w-[50px]"></TableHead>
              <TableHead className="whitespace-nowrap">No. Cheque</TableHead>
              <TableHead className="hidden sm:table-cell">Banco</TableHead>
              <TableHead>Beneficiario/Pagador</TableHead>
              <TableHead className="hidden md:table-cell">Vencimiento</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checks.map((check) => (
              <TableRow key={check.id} className="border-slate-50 dark:border-muted">
                <TableCell>
                  <Checkbox checked={check.status === 'cleared'} />
                </TableCell>
                <TableCell className="font-mono text-[10px] md:text-xs font-semibold whitespace-nowrap">{check.number}</TableCell>
                <TableCell className="hidden sm:table-cell">{check.bank}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate max-w-[100px] md:max-w-none">{check.party}</span>
                    <Badge variant="outline" className="w-fit text-[9px] h-3.5 mt-1 sm:hidden">
                      {check.type === 'issued' ? 'Emitido' : 'Por Cobrar'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <CalendarClock className="h-3 w-3" />
                    {check.dueDate}
                  </div>
                </TableCell>
                <TableCell className="font-bold whitespace-nowrap">${check.amount.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge 
                    variant={
                      check.status === 'cleared' ? 'default' : 
                      check.status === 'pending' ? 'secondary' : 'destructive'
                    }
                    className="capitalize text-[9px] md:text-[10px] px-1.5"
                  >
                    {check.status === 'pending' ? 'Pendiente' : 
                     check.status === 'cleared' ? 'Cobrado' : 'Cancelado'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                     <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
