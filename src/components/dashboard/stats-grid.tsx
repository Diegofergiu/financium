import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from "lucide-react"

export function StatsGrid() {
  const stats = [
    {
      title: "Balance Total",
      value: "$12,450.00",
      description: "Fondos líquidos disponibles",
      icon: Wallet,
      trend: "+2.5% desde el mes pasado",
      trendColor: "text-green-600",
    },
    {
      title: "Ingresos Mensuales",
      value: "$4,200.00",
      description: "Total para Junio 2024",
      icon: ArrowUpRight,
      trend: "3 fuentes de ingreso",
      trendColor: "text-blue-600",
    },
    {
      title: "Gastos Mensuales",
      value: "$2,850.50",
      description: "Total para Junio 2024",
      icon: ArrowDownRight,
      trend: "-12% vs mes pasado",
      trendColor: "text-red-600",
    },
    {
      title: "Tasa de Gasto",
      value: "$95.00",
      description: "Gasto promedio diario",
      icon: TrendingUp,
      trend: "Progreso estable",
      trendColor: "text-purple-600",
    },
  ]

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="shadow-sm border-none bg-white dark:bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center dark:bg-muted/20">
              <stat.icon className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
            <div className={`text-[10px] mt-2 font-semibold ${stat.trendColor}`}>
              {stat.trend}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
