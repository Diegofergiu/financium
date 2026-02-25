"use client"

import { useState } from "react"
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
import { Sparkles, Loader2, UploadCloud } from "lucide-react"
import { suggestTransactionCategory } from "@/ai/flows/suggest-transaction-category"
import { useToast } from "@/hooks/use-toast"

const formSchema = z.object({
  description: z.string().min(2, "Description is required"),
  amount: z.string().refine((val) => !isNaN(Number(val)), "Amount must be a number"),
  category: z.string().min(1, "Category is required"),
  date: z.string(),
  type: z.enum(["income", "expense"]),
  paymentMethod: z.string().min(1, "Method is required")
})

const categories = ["Food & Drink", "Groceries", "Utilities", "Rent", "Salary", "Investment", "Other"]

export function AddTransactionDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const { toast } = useToast()
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: "",
      category: "",
      date: new Date().toISOString().split('T')[0],
      type: "expense",
      paymentMethod: "Card"
    }
  })

  const onSuggestCategory = async () => {
    const desc = form.getValues("description")
    if (!desc) {
      toast({ title: "Please enter a description first" })
      return
    }

    setIsSuggesting(true)
    try {
      const result = await suggestTransactionCategory({
        transactionDescription: desc,
        availableCategories: categories
      })
      form.setValue("category", result.suggestedCategory)
      toast({ title: `AI suggested: ${result.suggestedCategory}` })
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to get AI suggestion" })
    } finally {
      setIsSuggesting(false)
    }
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
    setIsOpen(false)
    toast({ title: "Transaction added successfully" })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary hover:bg-primary/90">
          <Sparkles className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Record your income or expenses. Try AI suggestion for categories!
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input placeholder="e.g. Netflix Subscription" {...field} />
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
                    <FormLabel>Amount ($)</FormLabel>
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
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
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
                    <FormLabel>Payment Method</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Card" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="p-4 border-2 border-dashed rounded-lg bg-slate-50 dark:bg-muted/10 text-center cursor-pointer hover:bg-slate-100 transition-colors">
               <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
               <p className="text-xs text-muted-foreground">Click to upload receipt photo</p>
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full">Save Transaction</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}