import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Separator } from "@/components/ui/separator"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-muted-foreground">Financium App</h1>
          </div>
          <div className="flex items-center gap-4">
             {/* Dynamic search or notifications could go here */}
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 pt-0 overflow-auto bg-[#F7F9FB] dark:bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}