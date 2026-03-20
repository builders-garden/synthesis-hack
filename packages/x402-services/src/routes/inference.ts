import { Hono } from "hono";
import { callOpenRouter } from "../lib/openrouter.js";
import type { InferenceRequest } from "../types.js";

const INFERENCE_MODEL = "xiaomi/mimo-v2-omni";

const inference = new Hono();

inference.post("/", async (c) => {
  const body = await c.req.json<InferenceRequest>();

  if (
    !body.messages ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    return c.json(
      { error: "messages array is required and must not be empty" },
      400
    );
  }

  try {
    const result = await callOpenRouter({
      model: INFERENCE_MODEL,
      messages: body.messages,
      ...(body.max_tokens !== undefined && { max_tokens: body.max_tokens }),
      ...(body.temperature !== undefined && { temperature: body.temperature }),
    });

    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Inference failed";
    return c.json({ error: message }, 502);
  }
});

export { inference };
