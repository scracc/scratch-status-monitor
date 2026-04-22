import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Hono } from "hono";
import { getDb, initializeDb } from "./db/client";
import type { Env } from "./types/env";

function getAuth(env: Env) {
  initializeDb(env);

  if (!env.SSO_DISCORD_CLIENT_ID || !env.SSO_DISCORD_CLIENT_SECRET) {
    throw new Error("SSO_DISCORD_CLIENT_ID or SSO_DISCORD_CLIENT_SECRET is not set");
  }

  const db = getDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    socialProviders: {
      discord: {
        clientId: env.SSO_DISCORD_CLIENT_ID,
        clientSecret: env.SSO_DISCORD_CLIENT_SECRET,
      },
    },
  });
}

const AuthRouter = new Hono<{ Bindings: Env }>();

AuthRouter.on(["POST", "GET"], "/auth/*", (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

export { AuthRouter };