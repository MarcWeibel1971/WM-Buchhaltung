import { z } from "zod";

export const bankImportBookingSuggestionSchema = z.object({
  debitAccountNumber: z.string().trim().min(1),
  creditAccountNumber: z.string().trim().min(1),
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string().trim().min(1).max(2_000),
});

export type BankImportBookingSuggestion = z.infer<typeof bankImportBookingSuggestionSchema>;

const monetaryAmountSchema = z.union([z.number(), z.string()]).transform(value => Number(value)).pipe(z.number().finite().positive());

export const bankImportDocumentMatchMetadataSchema = z.object({
  totalAmount: monetaryAmountSchema,
  counterparty: z.string().optional(),
  documentDate: z.string().optional(),
  counterpartyIban: z.string().optional(),
  referenceNumber: z.string().optional(),
}).passthrough();
