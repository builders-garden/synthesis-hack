import { Hono } from "hono";
import { callOpenRouter } from "../lib/openrouter.js";
import type { ImageGenerationRequest } from "../types.js";

const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

const imageGeneration = new Hono();

imageGeneration.post("/", async (c) => {
  const body = await c.req.json<ImageGenerationRequest>();

  if (!body.prompt || typeof body.prompt !== "string") {
    return c.json({ error: "prompt is required and must be a string" }, 400);
  }

  try {
    const result = await callOpenRouter({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content: body.prompt }],
      modalities: ["image", "text"],
      ...(body.image_config && { image_config: body.image_config }),
    });

    return c.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Image generation failed";
    return c.json({ error: message }, 502);
  }
});

export { imageGeneration };
