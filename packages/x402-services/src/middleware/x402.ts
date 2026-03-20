import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import type { MiddlewareHandler } from "hono";
import {
  MODEL_PRICING,
  extractTokensFromMessages,
  estimateTokens,
  calculatePrice,
} from "../lib/pricing.js";

const FACILITATOR_URL = "https://facilitator.ultravioletadao.xyz";
const CELO_NETWORK = "eip155:42220" as const;
const CELO_USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";
const INFERENCE_MODEL = "xiaomi/mimo-v2-omni";

export function createX402Middleware(): MiddlewareHandler {
  const imageGenPayTo = process.env.IMAGE_GEN_PAY_TO_ADDRESS;
  const inferencePayTo = process.env.INFERENCE_PAY_TO_ADDRESS;

  if (!imageGenPayTo) {
    throw new Error("IMAGE_GEN_PAY_TO_ADDRESS environment variable is not set");
  }
  if (!inferencePayTo) {
    throw new Error(
      "INFERENCE_PAY_TO_ADDRESS environment variable is not set",
    );
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    CELO_NETWORK,
    new ExactEvmScheme(),
  );

  return paymentMiddleware(
    {
      "POST /api/image-generation": {
        accepts: [
          {
            scheme: "exact",
            network: CELO_NETWORK,
            payTo: imageGenPayTo,
            price: async (context) => {
              const body = (await context.adapter.getBody?.()) as {
                prompt?: string;
              } | null;

              const pricing = MODEL_PRICING[IMAGE_MODEL]!;
              const inputTokens = estimateTokens(body?.prompt ?? "");
              const maxOutputTokens = pricing.defaultMaxOutputTokens;

              return calculatePrice(inputTokens, maxOutputTokens, pricing);
            },
          },
        ],
        description: "Image generation via Gemini 3.1 Flash Image Preview",
        mimeType: "application/json",
      },
      "POST /api/inference": {
        accepts: [
          {
            scheme: "exact",
            network: CELO_NETWORK,
            payTo: inferencePayTo,
            price: async (context) => {
              const body = (await context.adapter.getBody?.()) as {
                messages?: Array<{ role: string; content: unknown }>;
                max_tokens?: number;
              } | null;

              const pricing = MODEL_PRICING[INFERENCE_MODEL]!;
              const inputTokens = extractTokensFromMessages(
                (body?.messages as Parameters<typeof extractTokensFromMessages>[0]) ?? [],
              );
              const maxOutputTokens =
                body?.max_tokens ?? pricing.defaultMaxOutputTokens;

              return calculatePrice(inputTokens, maxOutputTokens, pricing);
            },
          },
        ],
        description: "AI inference via Xiaomi MiMo v2 Omni",
        mimeType: "application/json",
      },
    },
    resourceServer,
  );
}
