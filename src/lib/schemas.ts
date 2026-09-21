import { z } from "zod";

export const extractionResultSchema = z.object({
  title: z.string().min(1).max(120),
  bulletPoints: z.array(z.string().min(1)).max(30),
  actionItems: z.array(z.string().min(1)).max(20),
  datesMentioned: z.array(z.string().min(1)).max(20),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export const extractionJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    bulletPoints: { type: "array", items: { type: "string" } },
    actionItems: { type: "array", items: { type: "string" } },
    datesMentioned: { type: "array", items: { type: "string" } },
  },
  required: ["title", "bulletPoints", "actionItems", "datesMentioned"],
} as const;
