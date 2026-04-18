import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { uploadRouter } from "../uploadRoute";
import { stripeWebhookRouter } from "../stripeWebhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { logger, requestLogger, errorLogger, installCrashHandlers } from "./logger";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Global crash handlers as early as possible.
  installCrashHandlers();

  const app = express();
  const server = createServer(app);

  const isProduction = process.env.NODE_ENV === "production";

  // Trust the first proxy hop (needed for rate-limit IP detection and secure
  // cookie handling behind a reverse proxy / load balancer in production).
  app.set("trust proxy", 1);

  // Structured request logger + x-request-id (must run before everything else
  // so that all downstream middlewares can use req.log).
  app.use(requestLogger);

  // Security headers via helmet. CSP is disabled in development because Vite's
  // HMR requires inline scripts and eval during dev.
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // Rate limits. The JSON/tRPC API gets a stricter limit than the OAuth
  // callback (which can receive a short burst during login).
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 300, // 300 requests / minute / IP
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });
  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });

  // Stripe webhook needs raw body for signature verification – MUST be
  // registered BEFORE the JSON body parser.
  app.use("/api/stripe/webhook", stripeWebhookRouter);

  // Body parser limits. Document uploads go through multer (separate size
  // limit in uploadRoute.ts), so the JSON body parser can be tight.
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));

  // Health check endpoint (no auth, no rate limit) – used by container
  // orchestrators and uptime monitors.
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Storage proxy for serving VRM/asset files
  registerStorageProxy(app);
  // OAuth callback under /api/oauth/callback
  app.use("/api/oauth", authLimiter);
  registerOAuthRoutes(app);
  // File upload endpoint
  app.use("/api/upload", uploadLimiter, uploadRouter);
  // tRPC API
  app.use("/api/trpc", apiLimiter);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Central error logger – must be registered AFTER all routes.
  app.use(errorLogger);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.warn({ preferredPort, port }, "preferred port busy, using fallback");
  }

  server.listen(port, () => {
    logger.info({ port, env: process.env.NODE_ENV }, "server started");
  });

  // Graceful shutdown: respond to SIGTERM/SIGINT, stop accepting new
  // connections, drain in-flight requests, then exit. Important for
  // Docker / K8s which send SIGTERM before SIGKILL.
  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutdown requested");
    server.close((err) => {
      if (err) {
        logger.error({ err }, "error during server.close()");
        process.exit(1);
      }
      logger.info("server closed cleanly");
      process.exit(0);
    });
    // Hard-exit after 15s to avoid hanging forever.
    setTimeout(() => {
      logger.error("shutdown timeout – forcing exit");
      process.exit(1);
    }, 15_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((err) => {
  logger.fatal({ err }, "server failed to start");
  process.exit(1);
});
