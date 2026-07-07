import Dexie, { type EntityTable } from "dexie";
import { DEFAULT_SETTINGS } from "./defaults";
import type { AppSettings, PracticeRecord } from "./types";

interface SettingRow {
  key: string;
  value: unknown;
}

const db = new Dexie("OsmolingoDatabase") as Dexie & {
  settings: EntityTable<SettingRow, "key">;
  questions: EntityTable<PracticeRecord, "id">;
};

db.version(1).stores({
  settings: "key",
  questions: "++id, createdAt, answeredAt, bookmarked, promptId, targetLanguage"
});

const SETTINGS_KEY = "app-settings";

export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.get(SETTINGS_KEY);
  if (!row) {
    await saveSettings(DEFAULT_SETTINGS);
    return structuredClone(DEFAULT_SETTINGS);
  }

  return mergeSettings(row.value as Partial<AppSettings>);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ key: SETTINGS_KEY, value: settings });
}

export async function addQuestion(record: PracticeRecord): Promise<number> {
  const id = await db.questions.add(record);
  if (typeof id !== "number") {
    throw new Error("Could not create question record.");
  }
  return id;
}

export async function updateQuestion(id: number, changes: Partial<PracticeRecord>): Promise<void> {
  await db.questions.update(id, changes);
}

export async function listQuestions(): Promise<PracticeRecord[]> {
  const rows = await db.questions.orderBy("createdAt").reverse().toArray();
  return rows;
}

export async function listBookmarkedQuestions(): Promise<PracticeRecord[]> {
  const rows = await db.questions.filter((record) => record.bookmarked).toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getQuestion(id: number): Promise<PracticeRecord | undefined> {
  return db.questions.get(id);
}

function mergeSettings(value: Partial<AppSettings>): AppSettings {
  const models = value.models?.length ? value.models : DEFAULT_SETTINGS.models;
  const prompts = DEFAULT_SETTINGS.prompts.map((prompt) => {
    const saved = value.prompts?.find((item) => item.id === prompt.id);
    return { ...prompt, ...saved };
  });

  return {
    ...DEFAULT_SETTINGS,
    ...value,
    models,
    prompts,
    notification: {
      ...DEFAULT_SETTINGS.notification,
      ...value.notification
    }
  };
}

export { db };
