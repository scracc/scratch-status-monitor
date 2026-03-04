import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const expenses = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "../../data/expenses" }),
  schema: z.object({
    payment_at: z.date(),
    from: z.string(),
    standard: z.string(),
    tax_percent: z.number(),
    paid: z.object({
      currency: z.string(),
      amount: z.number(),
      by: z.string(),
    }),
    items: z.array(
      z.object({
        name: z.string(),
        price: z.number(),
        quantity: z.number(),
        period: z
          .object({
            start_at: z.date(),
            end_at: z.date(),
          })
          .optional(),
      })
    ),
  }),
});

export const collections = { expenses };
