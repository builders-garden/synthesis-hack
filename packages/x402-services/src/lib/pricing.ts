export interface ModelPricing {
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
  defaultMaxOutputTokens: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "google/gemini-3.1-flash-image-preview": {
    inputPerMillionTokens: 0.5,
    outputPerMillionTokens: 3.0,
    defaultMaxOutputTokens: 1024,
  },
  "xiaomi/mimo-v2-omni": {
    inputPerMillionTokens: 0.4,
    outputPerMillionTokens: 2.0,
    defaultMaxOutputTokens: 2048,
  },
};

/**
 * Estimate token count from text. ~4 characters per token for English.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract estimated token count from a messages array,
 * handling both string content and multimodal content arrays.
 */
export function extractTokensFromMessages(
  messages: Array<{
    role: string;
    content:
      | string
      | Array<{
          type: string;
          text?: string;
          image_url?: unknown;
          input_audio?: { data: string };
        }>;
  }>,
): number {
  let total = 0;

  for (const msg of messages) {
    if (typeof msg.content === "string") {
      total += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text" && part.text) {
          total += estimateTokens(part.text);
        } else if (part.type === "image_url") {
          total += 256;
        } else if (part.type === "input_audio" && part.input_audio?.data) {
          total += Math.ceil(part.input_audio.data.length / 100);
        }
      }
    }
  }

  return total;
}

// USDC on Celo
export const CELO_USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const USDC_DECIMALS = 6;

export interface AssetAmount {
  asset: string;
  amount: string;
}

/**
 * Calculate price as USDC atomic units on Celo.
 * Returns an AssetAmount with the explicit USDC address so the SDK
 * doesn't need a default asset mapping for the network.
 * Floor at 1 atomic unit ($0.000001).
 */
export function calculatePrice(
  inputTokens: number,
  maxOutputTokens: number,
  pricing: ModelPricing,
): AssetAmount {
  const inputCost =
    (inputTokens / 1_000_000) * pricing.inputPerMillionTokens;
  const outputCost =
    (maxOutputTokens / 1_000_000) * pricing.outputPerMillionTokens;
  const totalUsd = Math.max(inputCost + outputCost, 0.000001);

  // Convert USD to USDC atomic units (6 decimals)
  const atomicUnits = Math.ceil(totalUsd * 10 ** USDC_DECIMALS);

  return {
    asset: CELO_USDC,
    amount: atomicUnits.toString(),
  };
}
