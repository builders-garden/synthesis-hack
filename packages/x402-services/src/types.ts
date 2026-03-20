// ----- Image Generation Endpoint -----

export interface ImageGenerationRequest {
  prompt: string;
  image_config?: {
    aspect_ratio?: string;
    image_size?: string;
  };
}

// ----- Inference Endpoint -----

export type MessageRole = "system" | "user" | "assistant";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image_url";
  image_url: { url: string };
}

export interface AudioContent {
  type: "input_audio";
  input_audio: { data: string; format: "wav" | "mp3" };
}

export type MessageContent =
  | string
  | (TextContent | ImageContent | AudioContent)[];

export interface ChatMessage {
  role: MessageRole;
  content: MessageContent;
}

export interface InferenceRequest {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
}

// ----- OpenRouter Shared Types -----

export interface OpenRouterRequest {
  model: string;
  messages: ChatMessage[];
  modalities?: string[];
  image_config?: ImageGenerationRequest["image_config"];
  max_tokens?: number;
  temperature?: number;
}

export interface OpenRouterChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
  };
  finish_reason: string | null;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterError {
  error: {
    code: number;
    message: string;
  };
}
