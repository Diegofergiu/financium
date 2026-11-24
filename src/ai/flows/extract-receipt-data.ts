'use server';
/**
 * @fileOverview A Genkit flow for extracting data from receipt or check images.
 *
 * - extractReceiptData - A function that handles the receipt/check data extraction process.
 * - ExtractReceiptDataInput - The input type for the extractReceiptData function.
 * - ExtractReceiptDataOutput - The return type for the extractReceiptData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractReceiptDataInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of a receipt or check, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractReceiptDataInput = z.infer<typeof ExtractReceiptDataInputSchema>;

const ExtractReceiptDataOutputSchema = z.object({
  date: z.string().describe('The date found on the receipt or check, in YYYY-MM-DD format.'),
  amount: z.number().describe('The total amount found on the receipt or check.'),
  vendorOrPayer: z.string().describe('The name of the vendor (for receipts) or payer (for checks).'),
  description: z.string().optional().describe('A general description or summary of items/purpose if discernible.'),
});
export type ExtractReceiptDataOutput = z.infer<typeof ExtractReceiptDataOutputSchema>;

export async function extractReceiptData(input: ExtractReceiptDataInput): Promise<ExtractReceiptDataOutput> {
  return extractReceiptDataFlow(input);
}

const extractReceiptDataPrompt = ai.definePrompt({
  name: 'extractReceiptDataPrompt',
  input: {schema: ExtractReceiptDataInputSchema},
  output: {schema: ExtractReceiptDataOutputSchema},
  prompt: `You are an expert at extracting financial information from images of receipts and checks.
Your task is to identify and extract the date, total amount, and the vendor or payer name from the provided image.
If a general description or summary of items is clearly discernible, include it in the 'description' field.
Respond strictly in the specified JSON format.

Image: {{media url=imageDataUri}}`,
  config: {
    model: 'googleai/gemini-2.5-flash',
  },
});

const extractReceiptDataFlow = ai.defineFlow(
  {
    name: 'extractReceiptDataFlow',
    inputSchema: ExtractReceiptDataInputSchema,
    outputSchema: ExtractReceiptDataOutputSchema,
  },
  async (input) => {
    const {output} = await extractReceiptDataPrompt(input);
    if (!output) {
        throw new Error("Failed to extract receipt data.");
    }
    return output;
  }
);
