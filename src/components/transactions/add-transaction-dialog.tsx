"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Loader2, UploadCloud, Plus } from "lucide-react"
import { suggestTransactionCategory } from "@/ai/flows/suggest-transaction-category"
import { useToast } from "@/hooks/use-toast"
import { useWalletStore } from "@/store/use-wallet-store"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore"

const formSchema = z.object({
  description: z.string().min(2, "La descripción es requerida"),
  amount: z.string().refine((val) => !isNaN(Number(val)), "El monto debe ser un número"),
  categoryId: z.string().min(1, "La categoría es requerida"),
  date: z.string(),
  type: z.enum(["income", "expense"]),
  paymentMethod: z.string().min(1, "El método es requerido")
})

export function AddTransactionDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const { toast } = useToast()
  const { activeWallet } = useWalletStore()
  const { user } = useUser()
  const db = useFirestore()

  const categoriesQuery = useMemoFirebase(() => {
    if (!activeWallet) return null;
    return query(collection(db, "wallets", activeWallet.id, "categories"), orderBy("name"));
  }, [db, activeWallet]);

  const { data: categories } = useCollection(categoriesQuery);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: "",
      categoryId: "",
      date: new Date().toISOString().split('T')[0],
      type: "expense",
      paymentMethod: "Efectivo"
    }
  })

  const onSuggestCategory = async () => {
    const desc = form.getValues("description")
    if (!desc) {
      toast({ title: "Ingresa una descripción para sugerir" })
      return
    }

    if (!categories || categories.length === 0) return;

    setIsSuggesting(true)
    try {
      const result = await suggestTransactionCategory({
        transactionDescription: desc,
        availableCategories: categories.map(c => c.name)
      })
      const found = categories.find(c => c.name === result.suggestedCategory);
      if (found) {
        form.setValue("categoryId", found.id)
        toast({ title: `Sugerencia: ${found.name}` })
      }
    } catch (e) {
      toast({ variant: "destructive", title: "IA no disponible momentáneamente" })
    } finally {
      setIsSuggesting(false)
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!activeWallet || !user) return;
    
    try {
      await addDoc(collection(db, "wallets", activeWallet.id, "transactions"), {
        walletId: activeWallet.id,
        description: values.description,
        amount: Number(values.amount),
        categoryId: values.categoryId,
        date: values.date,
        type: values.type,
        paymentMethod: values.paymentMethod,
        walletOwnerId: activeWallet.ownerId,
        walletMembersMap: activeWallet.members,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setIsOpen(false)
      form.reset()
      toast({ title: "Transacción registrada" })
    } catch (e) {
      toast({ variant: "destructive", title: "Error al registrar" })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary hover:bg-primary/90 w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Transacción
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Transacción</DialogTitle>
          <DialogDescription>
            Agrega un movimiento a <strong>{activeWallet?.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input placeholder="ej. Suscripción SaaS" {...field} />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={onSuggestCategory}
                        disabled={isSuggesting}
                      >
                        {isSuggesting ? (
                          <Loader2 className="h-4 w-4 animate-spin text-accent" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-accent" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto ($)</FormLabel>
                    <FormControl>
                      <Input placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="expense">Gasto</SelectItem>
                        <SelectItem value="income">Ingreso</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories?.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método</FormLabel>
                    <FormControl>
                      <Input placeholder="ej. Tarjeta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full">Registrar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
