"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const dummyAlerts = [
  { id: "1", bank: "Chase Bank", party: "Office Rental Inc.", amount: 1500, daysLeft: 2, type: "issued" },
  { id: "2", bank: "Wells Fargo", party: "Client X Project", amount: 2400, daysLeft: 4, type: "collectible" },
  { id: "3", bank: "BoA", party: "Suppliers Ltd.", amount: 800, daysLeft: 12, type: "issued" },
]

export function CheckAlerts() {
  return (
    <Card className="shadow-sm border-none overflow-hidden bg-white dark:bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold">Upcoming Checks</CardTitle>
        <Badge variant="outline" className="text-xs">Next 15 Days</Badge>
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
                        {alert.daysLeft} days remaining
                      </span>
                    </div>
                    <div className="pt-1 flex gap-2">
                      <Badge variant={alert.type === 'issued' ? 'secondary' : 'default'} className="text-[10px] h-4 px-1">
                        {alert.type === 'issued' ? 'Issued' : 'To Collect'}
                      </Badge>
                      {isCritical && (
                        <Badge variant="destructive" className="text-[10px] h-4 px-1 animate-pulse">
                          CRITICAL
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