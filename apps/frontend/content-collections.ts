import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
import { compileMDX } from "@content-collections/mdx";
import remarkGfm from "remark-gfm";
import { z } from "zod";

const content = defineCollection({
  name: "content",
  directory: "content",
  include: "**/*.mdx",
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    updated_at: z.string().optional(),
    content: z.string(),
  }),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document, {
      rehypePlugins: [],
      remarkPlugins: [remarkGfm],
    });
    return {
      ...document,
      mdx,
    };
  },
});

const policies = defineCollection({
  name: "policies",
  directory: "policies",
  include: "**/*.md",
  schema: z.object({
    title: z.string(),
    updated_at: z.string(),
    content: z.string(),
  }),
  transform: async (document, context) => {
    const html = await compileMarkdown(context, document);
    return {
      ...document,
      html,
    };
  },
});

export default defineConfig({
  content: [content, policies],
});
