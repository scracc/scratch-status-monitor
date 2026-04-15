import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools({
      eventBusConfig: {
        port: 4000,
        debug: false,
      },
    }),
    tailwindcss(),
    tanstackStart({
      router: {
        routeFileIgnorePattern: ".content.(ts|tsx|js|mjs|cjs|jsx|json|jsonc|json5)$",
      },
    }),
    viteReact(),
  ],
});

export default config;
