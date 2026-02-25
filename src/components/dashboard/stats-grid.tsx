import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from "lucide-react"

export function StatsGrid() {
  const stats = [
    {
      title: "Total Balance",
      value: "$12,450.00",
      description: "Available liquid funds",
      icon: Wallet,
      trend: "+2.5% from last month",
      trendColor: "text-green-600",
    },
    {
      title: "Monthly Income",
      value: "$4,200.00",
      description: "Total for June 2024",
      icon: ArrowUpRight,
      trend: "3 income sources",
      trendColor: "text-blue-600",
    },
    {
      title: "Monthly Expenses",
      value: "$2,850.50",
      description: "Total for June 2024",
      icon: ArrowDownRight,
      trend: "-12% vs last month",
      trendColor: "text-red-600",
    },
    {
      title: "Burn Rate",
      value: "$95.00",
      description: "Average daily spend",
      icon: TrendingUp,
      trend: "Steady progress",
      trendColor: "text-purple-600",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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