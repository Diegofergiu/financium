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
import { Coffee, ShoppingCart, Zap, CreditCard } from "lucide-react"

const transactions = [
  {
    id: "1",
    description: "Starbucks Café",
    category: "Comida y Bebida",
    amount: -12.50,
    date: "2024-06-15",
    method: "Tarjeta Débito",
    icon: Coffee,
    color: "bg-orange-100 text-orange-600"
  },
  {
    id: "2",
    description: "Pago Stripe",
    category: "Ingresos",
    amount: 1250.00,
    date: "2024-06-14",
    method: "Transferencia",
    icon: CreditCard,
    color: "bg-green-100 text-green-600"
  },
  {
    id: "3",
    description: "Supermercado",
    category: "Víveres",
    amount: -156.20,
    date: "2024-06-14",
    method: "Amex",
    icon: ShoppingCart,
    color: "bg-blue-100 text-blue-600"
  },
  {
    id: "4",
    description: "Factura Internet",
    category: "Servicios",
    amount: -85.00,
    date: "2024-06-12",
    method: "Pago Automático",
    icon: Zap,
    color: "bg-purple-100 text-purple-600"
  }
]

export function RecentTransactions() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <Card className="border-none shadow-sm bg-white dark:bg-card">
      <CardHeader>
        <CardTitle>Transacciones Recientes</CardTitle>
      </CardHeader>
      <CardContent>
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
            {transactions.map((t) => (
              <TableRow key={t.id} className="group border-slate-50 dark:border-muted">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${t.color}`}>
                      <t.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold truncate max-w-[120px] md:max-w-none">{t.description}</p>
                      <p className="text-[10px] text-muted-foreground">{t.date}</p>
                      <p className="text-[10px] sm:hidden text-muted-foreground">{t.category}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary" className="font-normal">{t.category}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{t.method}</TableCell>
                <TableCell className={`text-right font-bold ${t.amount < 0 ? "text-slate-900 dark:text-white" : "text-green-600"}`}>
                  {t.amount < 0 ? "" : "+"}${mounted 
                    ? Math.abs(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })
                    : Math.abs(t.amount).toFixed(2)
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
