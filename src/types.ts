export type PromptId = "business" | "everyday";
export type ProviderId = "openai" | "openrouter" | "gemini" | string;

export interface ProviderModel {
  id: string;
  provider: ProviderId;
  label: string;
  model: string;
  enabled: boolean;
}

export interface PromptConfig {
  id: PromptId;
  name: string;
  weight: number;
  text: string;
}

export interface NotificationSettings {
  enabled: boolean;
  windowStart: string;
  windowEnd: string;
  intervalMinutes: number;
  lastSentAt?: string;
}

export interface AppSettings {
  userLanguage: string;
  targetLanguage: string;
  selectedModelId: string;
  prompts: PromptConfig[];
  correctionPrompt: string;
  notification: NotificationSettings;
  models: ProviderModel[];
}

export interface GeneratedQuestion {
  question: string;
  hints: string[];
  context: string;
}

export interface CorrectionResult {
  mark: number;
  corrected: string;
  improved: string;
  explanation: string;
}

export interface PracticeRecord {
  id?: number;
  question: string;
  hints: string[];
  context: string;
  promptId: PromptId;
  userLanguage: string;
  targetLanguage: string;
  provider: ProviderId;
  model: string;
  answer?: string;
  correction?: CorrectionResult;
  bookmarked: boolean;
  createdAt: string;
  answeredAt?: string;
}

export interface LlmRequest {
  provider: ProviderId;
  model: string;
  system: string;
  user: string;
}
