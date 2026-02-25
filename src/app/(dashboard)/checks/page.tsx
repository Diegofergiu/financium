import { ChecksTable } from "@/components/checks/checks-table"
import { Button } from "@/components/ui/button"
import { Plus, Ticket } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ChecksPage() {
  return (
    <div className="flex flex-col gap-6 pt-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center text-white">
            <Ticket className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Checks Module</h2>
            <p className="text-muted-foreground">
              Manage issued and collectible checks with real-time alerts.
            </p>
          </div>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Register New Check
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-white dark:bg-card border-none shadow-sm h-12 p-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">All Checks</TabsTrigger>
          <TabsTrigger value="issued" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">Issued</TabsTrigger>
          <TabsTrigger value="collectible" className="data-[state=active]:bg-primary data-[state=active]:text-white px-6">To Collect</TabsTrigger>
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