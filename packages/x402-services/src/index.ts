import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createX402Middleware } from "./middleware/x402.js";
import { imageGeneration } from "./routes/image-generation.js";
import { inference } from "./routes/inference.js";

const app = new Hono();

app.use(createX402Middleware());

app.route("/api/image-generation", imageGeneration);
app.route("/api/inference", inference);

app.get("/health", (c) => c.json({ ok: true }));

const PORT = parseInt(process.env.PORT || "3002", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`x402-services listening on port ${info.port}`);
});
