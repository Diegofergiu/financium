import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-transaction-category.ts';
import '@/ai/flows/extract-receipt-data.ts';