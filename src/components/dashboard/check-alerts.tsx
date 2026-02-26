"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useWalletStore } from "@/store/use-wallet-store"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, where, orderBy, limit } from "firebase/firestore"
import { differenceInDays, parseISO } from "date-fns"

export function CheckAlerts() {
  const [mounted, setMounted] = useState(false)
  const { activeWallet } = useWalletStore()
  const db = useFirestore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const checksQuery = useMemoFirebase(() => {
    if (!activeWallet) return null;
    return query(
      collection(db, "wallets", activeWallet.id, "checks"),
      where("status", "==", "pending"),
      orderBy("dueDate", "asc"),
      limit(5)
    );
  }, [db, activeWallet]);

  const { data: checks, isLoading } = useCollection(checksQuery);

  return (
    <Card className="shadow-sm border-none overflow-hidden bg-white dark:bg-card h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold">Próximos Cheques</CardTitle>
        <Badge variant="outline" className="text-xs">Pendientes</Badge>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : checks && checks.length > 0 ? (
            <div className="space-y-4">
              {checks.map((check) => {
                const daysLeft = differenceInDays(parseISO(check.dueDate), new Date());
                const isCritical = daysLeft < 5;
                
                return (
                  <div 
                    key={check.id} 
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
                        <p className="text-sm font-semibold truncate max-w-[150px]">{check.issuerRecipient}</p>
                        <span className={`text-sm font-bold ${isCritical ? "text-red-600" : ""}`}>
                          ${mounted ? check.amount.toLocaleString() : check.amount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{check.bank}</span>
                        <span className={isCritical ? "text-red-600 font-medium" : ""}>
                          {daysLeft < 0 ? "Vencido" : `En ${daysLeft} días`}
                        </span>
                      </div>
                      <div className="pt-1 flex gap-2">
                        <Badge variant={check.type === 'issued' ? 'secondary' : 'default'} className="text-[10px] h-4 px-1">
                          {check.type === 'issued' ? 'Emitido' : 'Por Cobrar'}
                        </Badge>
                        {isCritical && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1 animate-pulse">
                            CRÍTICO
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground italic text-sm">No hay cheques pendientes próximos.</div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
