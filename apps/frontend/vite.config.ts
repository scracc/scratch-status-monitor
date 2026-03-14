import { fileURLToPath, URL } from "node:url";
import contentCollections from "@content-collections/vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { intlayer } from "vite-intlayer";
import tsConfigPaths from "vite-tsconfig-paths";
import { envCheckPlugin } from "./src/plugins/envrc/vite-plugin";
import { sitemapPlugin } from "./src/plugins/sitemap/vite-plugin";

const config = defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    envCheckPlugin(), // 環境変数チェックを最初に実行
    intlayer(),
    contentCollections(),
    tailwindcss(),
    devtools({
      eventBusConfig: {
        port: 4000,
        debug: false,
      },
      editor: {
        name: "VSCode",
        open: async (path, lineNumber, columnNumber) => {
          const { exec } = await import("node:child_process");
          exec(
            // or windsurf/cursor/webstorm
            `code -g "${(path).replaceAll("$", "\\$")}${lineNumber ? `:${lineNumber}` : ""}${columnNumber ? `:${columnNumber}` : ""}"`
          );
        },
      },
    }),
    tanstackStart({
      router: {
        routeFileIgnorePattern: ".content.(ts|tsx|js|mjs|cjs|jsx|json|jsonc|json5)$",
      },
    }),
    sentryTanstackStart({
      org: "scracc",
      project: "ssm",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
    sitemapPlugin(),
    nitro(),
    viteReact(),
  ],
});

export default config;
