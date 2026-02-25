import { ChecksTable } from "@/components/checks/checks-table"
import { Button } from "@/components/ui/button"
import { Plus, Ticket } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ChecksPage() {
  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center text-white shrink-0">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Módulo de Cheques</h2>
            <p className="text-muted-foreground text-sm md:text-base">
              Gestiona cheques emitidos y por cobrar con alertas en tiempo real.
            </p>
          </div>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90 w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Registrar Nuevo Cheque
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-white dark:bg-card border-none shadow-sm h-auto p-1 flex-wrap">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-white px-4 md:px-6 flex-1 sm:flex-none">Todos</TabsTrigger>
          <TabsTrigger value="issued" className="data-[state=active]:bg-primary data-[state=active]:text-white px-4 md:px-6 flex-1 sm:flex-none">Emitidos</TabsTrigger>
          <TabsTrigger value="collectible" className="data-[state=active]:bg-primary data-[state=active]:text-white px-4 md:px-6 flex-1 sm:flex-none">Por Cobrar</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <ChecksTable />
        </TabsContent>
        <TabsContent value="issued" className="mt-4">
           <ChecksTable />
        </TabsContent>
        <TabsContent value="collectible" className="mt-4">
           <ChecksTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}
