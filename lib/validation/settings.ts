import { z } from "zod";

export const settingsSchema = z.object({
  timezone: z.string().trim().min(1),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  overloadThreshold: z.number().int().min(1).max(99),
});

export const passphraseSchema = z.object({
  currentPassphrase: z.string().min(1),
  newPassphrase: z.string().min(8),
});
