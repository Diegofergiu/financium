'use server';
/**
 * @fileOverview A Genkit flow for suggesting a transaction category based on its description.
 *
 * - suggestTransactionCategory - A function that handles the transaction category suggestion process.
 * - SuggestTransactionCategoryInput - The input type for the suggestTransactionCategory function.
 * - SuggestTransactionCategoryOutput - The return type for the suggestTransactionCategory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTransactionCategoryInputSchema = z.object({
  transactionDescription: z.string().describe('The description of the transaction.'),
  availableCategories: z.array(z.string()).describe('A list of available categories to choose from.').min(1, 'At least one category must be provided.'),
});
export type SuggestTransactionCategoryInput = z.infer<typeof SuggestTransactionCategoryInputSchema>;

const SuggestTransactionCategoryOutputSchema = z.object({
  suggestedCategory: z.string().describe('The most suitable category from the provided list for the transaction description.'),
  reasoning: z.string().optional().describe('The reasoning behind the suggested category.'),
});
export type SuggestTransactionCategoryOutput = z.infer<typeof SuggestTransactionCategoryOutputSchema>;

export async function suggestTransactionCategory(
  input: SuggestTransactionCategoryInput
): Promise<SuggestTransactionCategoryOutput> {
  return suggestTransactionCategoryFlow(input);
}

const suggestTransactionCategoryPrompt = ai.definePrompt({
  name: 'suggestTransactionCategoryPrompt',
  input: {schema: SuggestTransactionCategoryInputSchema},
  output: {schema: SuggestTransactionCategoryOutputSchema},
  prompt: `You are an expert in financial transaction categorization.
Your task is to analyze the provided transaction description and suggest the most suitable category from the given list of available categories.

Available Categories: {{{json availableCategories}}}

Transaction Description: {{{transactionDescription}}}

Based on the transaction description, please suggest the best matching category from the available categories. If none of the categories are a perfect match, pick the closest one. Provide a brief reasoning for your choice.`,
});

const suggestTransactionCategoryFlow = ai.defineFlow(
  {
    name: 'suggestTransactionCategoryFlow',
    inputSchema: SuggestTransactionCategoryInputSchema,
    outputSchema: SuggestTransactionCategoryOutputSchema,
  },
  async input => {
    const {output} = await suggestTransactionCategoryPrompt(input);
    return output!;
  }
);
