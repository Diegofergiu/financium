"use client"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const dummyAlerts = [
  { id: "1", bank: "Banco Chase", party: "Alquiler Oficinas S.A.", amount: 1500, daysLeft: 2, type: "issued" },
  { id: "2", bank: "Wells Fargo", party: "Proyecto Cliente X", amount: 2400, daysLeft: 4, type: "collectible" },
  { id: "3", bank: "BoA", party: "Proveedores Unidos", amount: 800, daysLeft: 12, type: "issued" },
]

export function CheckAlerts() {
  return (
    <Card className="shadow-sm border-none overflow-hidden bg-white dark:bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold">Próximos Cheques</CardTitle>
        <Badge variant="outline" className="text-xs">Próximos 15 días</Badge>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {dummyAlerts.map((alert) => {
              const isCritical = alert.daysLeft < 5
              return (
                <div 
                  key={alert.id} 
                  className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                    isCritical 
                    ? "bg-red-50/50 border-red-100 dark:bg-red-950/20 dark:border-red-900/30" 
                    : "bg-slate-50/50 border-slate-100 dark:bg-muted/20 dark:border-muted"
                  }`}
                >
                  <div className={`mt-0.5 ${isCritical ? "text-red-500" : "text-blue-500"}`}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{alert.party}</p>
                      <span className={`text-sm font-bold ${isCritical ? "text-red-600" : ""}`}>
                        ${alert.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{alert.bank}</span>
                      <span className={isCritical ? "text-red-600 font-medium" : ""}>
                        Quedan {alert.daysLeft} días
                      </span>
                    </div>
                    <div className="pt-1 flex gap-2">
                      <Badge variant={alert.type === 'issued' ? 'secondary' : 'default'} className="text-[10px] h-4 px-1">
                        {alert.type === 'issued' ? 'Emitido' : 'Por Cobrar'}
                      </Badge>
                      {isCritical && (
                        <Badge variant="destructive" className="text-[10px] h-4 px-1 animate-pulse">
                          CRÍTICO
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
