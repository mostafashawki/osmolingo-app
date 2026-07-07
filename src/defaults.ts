import type { AppSettings, PromptConfig, ProviderModel } from "./types";

export const DEFAULT_MODELS: ProviderModel[] = [
  {
    id: "openai-gpt-5-4-nano",
    provider: "openai",
    label: "OpenAI GPT-5.4 nano",
    model: "gpt-5.4-nano",
    enabled: true
  },
  {
    id: "openai-gpt-5-4-mini",
    provider: "openai",
    label: "OpenAI GPT-5.4 mini",
    model: "gpt-5.4-mini",
    enabled: true
  },
  {
    id: "openrouter-haiku-4-5",
    provider: "openrouter",
    label: "OpenRouter Anthropic Haiku 4.5",
    model: "anthropic/claude-haiku-4.5",
    enabled: true
  },
  {
    id: "gemini-flash",
    provider: "gemini",
    label: "Gemini Flash",
    model: "gemini-2.5-flash",
    enabled: true
  }
];

export const DEFAULT_PROMPTS: PromptConfig[] = [
  {
    id: "business",
    name: "Business and software work",
    weight: 65,
    text: [
      "Generate one short, natural language-learning question for a software engineer in a business context.",
      "Use non-technical HR interview, office, meeting, planning, feedback, stakeholder, or daily standup situations.",
      "Avoid coding trivia and avoid asking for technical implementation details.",
      "The question must be in the target language.",
      "Return JSON only with keys: question, hints, context.",
      "hints must be 3 concise options or ideas in the user's language, not translations of the whole answer."
    ].join(" ")
  },
  {
    id: "everyday",
    name: "Everyday life",
    weight: 35,
    text: [
      "Generate one short, natural language-learning question about everyday life.",
      "Use practical situations like appointments, shopping, neighbors, transport, family, food, health, hobbies, or small talk.",
      "The question must be in the target language.",
      "Return JSON only with keys: question, hints, context.",
      "hints must be 3 concise options or ideas in the user's language, not translations of the whole answer."
    ].join(" ")
  }
];

export const DEFAULT_CORRECTION_PROMPT = [
  "Correct the learner's answer for grammar, spelling, word choice, and naturalness.",
  "Return JSON only with keys: mark, corrected, improved, explanation.",
  "mark must be an integer from 0 to 10.",
  "corrected removes grammar mistakes and typos while preserving the learner's intent.",
  "improved should show what a native speaker would usually say in this situation.",
  "explanation must be concise and written in the user's language."
].join(" ");

export const DEFAULT_SETTINGS: AppSettings = {
  userLanguage: "English",
  targetLanguage: "German",
  selectedModelId: DEFAULT_MODELS[0].id,
  prompts: DEFAULT_PROMPTS,
  correctionPrompt: DEFAULT_CORRECTION_PROMPT,
  notification: {
    enabled: false,
    windowStart: "09:00",
    windowEnd: "17:00",
    intervalMinutes: 30
  },
  models: DEFAULT_MODELS
};
