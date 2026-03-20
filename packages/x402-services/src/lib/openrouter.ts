import type {
  OpenRouterRequest,
  OpenRouterResponse,
  OpenRouterError,
} from "../types.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function callOpenRouter(
  body: OpenRouterRequest
): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  const response = await fetch(OPENROUTER_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as OpenRouterError | null;
    const message =
      errorBody?.error?.message ?? `OpenRouter returned ${response.status}`;
    throw new Error(message);
  }

  return (await response.json()) as OpenRouterResponse;
}
