import { createContext } from "@bikalpo-project/api/context";
import { appRouter } from "@bikalpo-project/api/routers/index";
import { auth } from "@bikalpo-project/auth";
import { env } from "@bikalpo-project/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Auth routes: /auth/*
app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));

// Docs handler with Scalar UI at /docs
export const docsHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bikalpo API",
          version: "1.0.0",
        },
        servers: [{ url: env.BETTER_AUTH_URL }],
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

// REST API handler (endpoints at root: /brands, /categories, etc.)
export const apiHandler = new OpenAPIHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

// RPC handler for ORPC client calls
export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  // RPC endpoints at /rpc
  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  // API documentation at /docs
  const docsResult = await docsHandler.handle(c.req.raw, {
    prefix: "/docs",
    context: context,
  });

  if (docsResult.matched) {
    return c.newResponse(docsResult.response.body, docsResult.response);
  }

  // REST API endpoints at root (no /api prefix)
  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/",
    context: context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.get("/", (c) => {
  return c.json({
    name: "Bikalpo API",
    version: "1.0.0",
    docs: "/docs",
  });
});

export default app;
