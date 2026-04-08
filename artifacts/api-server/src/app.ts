import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";

const app: Express = express();
const useMockApi =
  process.env["GUARDIAN_LOCAL_MOCK_API"] === "1" ||
  !process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"] ||
  !process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"] ||
  !process.env["DATABASE_URL"];

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

if (useMockApi) {
  logger.warn(
    {
      useMockApi,
      hasAnthropicBaseUrl: Boolean(process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"]),
      hasAnthropicApiKey: Boolean(process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"]),
      hasDatabaseUrl: Boolean(process.env["DATABASE_URL"]),
    },
    "Starting API server in local mock mode",
  );
  const { createMockRouter } = await import("./routes/mock");
  app.use("/api", createMockRouter());
} else {
  const { default: router } = await import("./routes");
  app.use("/api", router);
}

export default app;
