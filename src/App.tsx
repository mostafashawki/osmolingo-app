import { useEffect, useMemo, useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import {
  Bell,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  History,
  Home,
  Languages,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Trash2
} from "lucide-react";
import { getSettings, listQuestions, saveSettings, updateQuestion } from "./db";
import { DEFAULT_MODELS } from "./defaults";
import { correctAnswer, generateQuestion } from "./llm";
import {
  requestNotificationPermission,
  startNotificationScheduler,
  stopNotificationScheduler
} from "./notifications";
import type { AppSettings, PracticeRecord, ProviderModel, PromptId } from "./types";

type Tab = "practice" | "history" | "bookmarks" | "settings";

const emptyModel: ProviderModel = {
  id: "",
  provider: "openai",
  label: "",
  model: "",
  enabled: true
};

export default function App() {
  const [settings, setSettings] = useState<AppSettings>();
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [activeRecord, setActiveRecord] = useState<PracticeRecord>();
  const [answer, setAnswer] = useState("");
  const [tab, setTab] = useState<Tab>("practice");
  const [showHints, setShowHints] = useState(false);
  const [busy, setBusy] = useState<"generate" | "correct" | "save" | null>(null);
  const [error, setError] = useState("");
  const [modelDraft, setModelDraft] = useState<ProviderModel>(emptyModel);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!settings?.notification.enabled) {
      stopNotificationScheduler();
      return;
    }

    startNotificationScheduler((record) => {
      setActiveRecord(record);
      setRecords((current) => [record, ...current]);
      setTab("practice");
    });

    return stopNotificationScheduler;
  }, [settings?.notification.enabled]);

  const answeredRecords = useMemo(() => records.filter((record) => record.correction), [records]);
  const averageMark = useMemo(() => {
    if (!answeredRecords.length) return undefined;
    const total = answeredRecords.reduce((sum, record) => sum + (record.correction?.mark ?? 0), 0);
    return Math.round((total / answeredRecords.length) * 10) / 10;
  }, [answeredRecords]);

  async function refresh() {
    const [storedSettings, storedRecords] = await Promise.all([getSettings(), listQuestions()]);
    setSettings(storedSettings);
    setRecords(storedRecords);
    setActiveRecord((current) => current ?? storedRecords[0]);
  }

  async function handleGenerate(promptId?: PromptId) {
    if (!settings) return;
    setBusy("generate");
    setError("");
    try {
      const record = await generateQuestion(settings, promptId);
      setActiveRecord(record);
      setAnswer("");
      setShowHints(false);
      setRecords((current) => [record, ...current]);
      setTab("practice");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate a question.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCorrect() {
    if (!settings || !activeRecord || !answer.trim()) return;
    setBusy("correct");
    setError("");
    try {
      const correction = await correctAnswer(settings, activeRecord, answer.trim());
      const updated = {
        ...activeRecord,
        answer: answer.trim(),
        correction,
        answeredAt: new Date().toISOString()
      };
      setActiveRecord(updated);
      setRecords((current) => current.map((record) => (record.id === updated.id ? updated : record)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not correct the answer.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleBookmark(record: PracticeRecord) {
    if (!record.id) return;
    const bookmarked = !record.bookmarked;
    await updateQuestion(record.id, { bookmarked });
    const updated = { ...record, bookmarked };
    setRecords((current) => current.map((item) => (item.id === record.id ? updated : item)));
    if (activeRecord?.id === record.id) setActiveRecord(updated);
  }

  async function persistSettings(nextSettings: AppSettings) {
    setBusy("save");
    setError("");
    try {
      await saveSettings(nextSettings);
      setSettings(nextSettings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save settings.");
    } finally {
      setBusy(null);
    }
  }

  function updateSettings(mutator: (settings: AppSettings) => AppSettings) {
    if (!settings) return;
    setSettings(mutator(settings));
  }

  function addModel() {
    if (!settings || !modelDraft.label.trim() || !modelDraft.model.trim()) return;
    const provider = modelDraft.provider.trim() || "openai";
    const model = {
      ...modelDraft,
      provider,
      id: `${provider}-${modelDraft.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    };
    setSettings({
      ...settings,
      models: [...settings.models, model],
      selectedModelId: settings.selectedModelId || model.id
    });
    setModelDraft(emptyModel);
  }

  if (!settings) {
    return (
      <main className="boot">
        <Loader2 className="spin" aria-hidden="true" />
      </main>
    );
  }

  const selectedModel = settings.models.find((model) => model.id === settings.selectedModelId);
  const bookmarked = records.filter((record) => record.bookmarked);

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <div className="brand-mark">
            <Languages aria-hidden="true" />
          </div>
          <div>
            <strong>Osmolingo</strong>
            <span>{settings.targetLanguage} practice</span>
          </div>
        </div>

        <nav className="nav">
          <NavButton icon={<Home />} label="Practice" active={tab === "practice"} onClick={() => setTab("practice")} />
          <NavButton icon={<History />} label="History" active={tab === "history"} onClick={() => setTab("history")} />
          <NavButton
            icon={<Bookmark />}
            label="Bookmarks"
            active={tab === "bookmarks"}
            onClick={() => setTab("bookmarks")}
          />
          <NavButton
            icon={<Settings />}
            label="Settings"
            active={tab === "settings"}
            onClick={() => setTab("settings")}
          />
        </nav>

        <section className="stats-panel" aria-label="Progress summary">
          <span>Average mark</span>
          <strong>{averageMark ?? "-"}</strong>
          <small>{answeredRecords.length} corrected answers</small>
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{tabTitle(tab)}</h1>
            <p>
              {selectedModel ? selectedModel.label : "Select a model"} · {settings.userLanguage} to{" "}
              {settings.targetLanguage}
            </p>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => void handleGenerate()} disabled={busy !== null} title="New mixed question">
              {busy === "generate" ? <Loader2 className="spin" /> : <RefreshCw />}
            </button>
            <button className="primary" onClick={() => void handleGenerate()} disabled={busy !== null}>
              <Sparkles aria-hidden="true" />
              New question
            </button>
          </div>
        </header>

        {error && <div className="error">{error}</div>}

        {tab === "practice" && (
          <PracticeView
            record={activeRecord}
            answer={answer}
            busy={busy}
            showHints={showHints}
            onAnswer={setAnswer}
            onHints={() => setShowHints((value) => !value)}
            onCorrect={() => void handleCorrect()}
            onBookmark={() => activeRecord && void toggleBookmark(activeRecord)}
            onGenerate={handleGenerate}
          />
        )}

        {tab === "history" && (
          <RecordList
            records={records}
            empty="No questions yet."
            onOpen={(record) => {
              setActiveRecord(record);
              setAnswer(record.answer ?? "");
              setTab("practice");
            }}
            onBookmark={toggleBookmark}
          />
        )}

        {tab === "bookmarks" && (
          <RecordList
            records={bookmarked}
            empty="No bookmarked questions yet."
            onOpen={(record) => {
              setActiveRecord(record);
              setAnswer(record.answer ?? "");
              setTab("practice");
            }}
            onBookmark={toggleBookmark}
          />
        )}

        {tab === "settings" && (
          <SettingsView
            settings={settings}
            busy={busy}
            modelDraft={modelDraft}
            onModelDraft={setModelDraft}
            onChange={updateSettings}
            onSave={() => void persistSettings(settings)}
            onPermission={() => void requestNotificationPermission()}
            onAddModel={addModel}
          />
        )}
      </section>
    </main>
  );
}

function PracticeView({
  record,
  answer,
  busy,
  showHints,
  onAnswer,
  onHints,
  onCorrect,
  onBookmark,
  onGenerate
}: {
  record?: PracticeRecord;
  answer: string;
  busy: "generate" | "correct" | "save" | null;
  showHints: boolean;
  onAnswer: (value: string) => void;
  onHints: () => void;
  onCorrect: () => void;
  onBookmark: () => void;
  onGenerate: (promptId?: PromptId) => Promise<void>;
}) {
  if (!record) {
    return (
      <section className="empty-state">
        <Languages aria-hidden="true" />
        <h2>Start with a question</h2>
        <div className="split-actions">
          <button className="primary" onClick={() => void onGenerate("business")} disabled={busy !== null}>
            <BriefcaseBusiness aria-hidden="true" />
            Business
          </button>
          <button className="secondary" onClick={() => void onGenerate("everyday")} disabled={busy !== null}>
            <Home aria-hidden="true" />
            Everyday
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="practice-grid">
      <article className="question-panel">
        <div className="question-meta">
          <span>{record.promptId === "business" ? "Business" : "Everyday"}</span>
          <button className="icon-button" onClick={onBookmark} title="Bookmark question">
            {record.bookmarked ? <BookmarkCheck /> : <Bookmark />}
          </button>
        </div>
        <h2>{record.question}</h2>
        <p>{record.context}</p>
        <div className="question-actions">
          <button className="secondary" onClick={onHints}>
            {showHints ? <Check aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            Hints
          </button>
          <button className="ghost" onClick={() => void onGenerate("business")} disabled={busy !== null}>
            Business
          </button>
          <button className="ghost" onClick={() => void onGenerate("everyday")} disabled={busy !== null}>
            Everyday
          </button>
        </div>
        {showHints && (
          <ul className="hints">
            {record.hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        )}
      </article>

      <article className="answer-panel">
        <label htmlFor="answer">Your answer</label>
        <textarea
          id="answer"
          value={answer}
          onChange={(event) => onAnswer(event.target.value)}
          rows={8}
          placeholder="Write your answer here..."
        />
        <button className="primary wide" onClick={onCorrect} disabled={busy !== null || !answer.trim()}>
          {busy === "correct" ? <Loader2 className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
          Correct answer
        </button>
      </article>

      {record.correction && (
        <article className="correction-panel">
          <div className="mark">
            <span>Mark</span>
            <strong>{record.correction.mark}/10</strong>
          </div>
          <ResultBlock title="Corrected" value={record.correction.corrected} />
          <ResultBlock title="Native version" value={record.correction.improved} />
          <ResultBlock title="Notes" value={record.correction.explanation} />
        </article>
      )}
    </section>
  );
}

function SettingsView({
  settings,
  busy,
  modelDraft,
  onModelDraft,
  onChange,
  onSave,
  onPermission,
  onAddModel
}: {
  settings: AppSettings;
  busy: "generate" | "correct" | "save" | null;
  modelDraft: ProviderModel;
  onModelDraft: (model: ProviderModel) => void;
  onChange: (mutator: (settings: AppSettings) => AppSettings) => void;
  onSave: () => void;
  onPermission: () => void;
  onAddModel: () => void;
}) {
  return (
    <section className="settings-grid">
      <article className="settings-section">
        <h2>Language</h2>
        <div className="field-row">
          <label>
            User language
            <input
              value={settings.userLanguage}
              onChange={(event) => onChange((current) => ({ ...current, userLanguage: event.target.value }))}
            />
          </label>
          <label>
            Target language
            <input
              value={settings.targetLanguage}
              onChange={(event) => onChange((current) => ({ ...current, targetLanguage: event.target.value }))}
            />
          </label>
        </div>
      </article>

      <article className="settings-section">
        <h2>Notifications</h2>
        <div className="toggle-row">
          <div>
            <strong>Practice notifications</strong>
            <span>Generated inside the configured daily window while the app is running.</span>
          </div>
          <Switch.Root
            className="switch"
            checked={settings.notification.enabled}
            onCheckedChange={(checked) =>
              onChange((current) => ({
                ...current,
                notification: { ...current.notification, enabled: checked }
              }))
            }
            aria-label="Toggle practice notifications"
          >
            <Switch.Thumb className="switch-thumb" />
          </Switch.Root>
        </div>
        <div className="field-row compact">
          <label>
            From
            <input
              type="time"
              value={settings.notification.windowStart}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  notification: { ...current.notification, windowStart: event.target.value }
                }))
              }
            />
          </label>
          <label>
            To
            <input
              type="time"
              value={settings.notification.windowEnd}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  notification: { ...current.notification, windowEnd: event.target.value }
                }))
              }
            />
          </label>
          <label>
            Interval
            <input
              type="number"
              min={5}
              max={240}
              value={settings.notification.intervalMinutes}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  notification: {
                    ...current.notification,
                    intervalMinutes: Number(event.target.value)
                  }
                }))
              }
            />
          </label>
        </div>
        <button className="secondary" onClick={onPermission}>
          <Bell aria-hidden="true" />
          Allow notifications
        </button>
      </article>

      <article className="settings-section">
        <h2>Question mix</h2>
        {settings.prompts.map((prompt) => (
          <label className="range-field" key={prompt.id}>
            <span>
              {prompt.name}
              <strong>{prompt.weight}%</strong>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={prompt.weight}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  prompts: current.prompts.map((item) =>
                    item.id === prompt.id ? { ...item, weight: Number(event.target.value) } : item
                  )
                }))
              }
            />
            <textarea
              value={prompt.text}
              rows={4}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  prompts: current.prompts.map((item) =>
                    item.id === prompt.id ? { ...item, text: event.target.value } : item
                  )
                }))
              }
            />
          </label>
        ))}
      </article>

      <article className="settings-section">
        <h2>Correction prompt</h2>
        <textarea
          value={settings.correctionPrompt}
          rows={6}
          onChange={(event) => onChange((current) => ({ ...current, correctionPrompt: event.target.value }))}
        />
      </article>

      <article className="settings-section wide-section">
        <h2>LLM provider and models</h2>
        <label>
          Active model
          <select
            value={settings.selectedModelId}
            onChange={(event) => onChange((current) => ({ ...current, selectedModelId: event.target.value }))}
          >
            {settings.models
              .filter((model) => model.enabled)
              .map((model) => (
                <option value={model.id} key={model.id}>
                  {model.label} ({model.model})
                </option>
              ))}
          </select>
        </label>
        <div className="model-list">
          {settings.models.map((model) => (
            <div className="model-row" key={model.id}>
              <input
                value={model.label}
                aria-label="Model label"
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    models: current.models.map((item) =>
                      item.id === model.id ? { ...item, label: event.target.value } : item
                    )
                  }))
                }
              />
              <input
                value={model.provider}
                aria-label="Provider"
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    models: current.models.map((item) =>
                      item.id === model.id ? { ...item, provider: event.target.value } : item
                    )
                  }))
                }
              />
              <input
                value={model.model}
                aria-label="Model id"
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    models: current.models.map((item) =>
                      item.id === model.id ? { ...item, model: event.target.value } : item
                    )
                  }))
                }
              />
              <button
                className="icon-button"
                title={model.enabled ? "Disable model" : "Enable model"}
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    models: current.models.map((item) =>
                      item.id === model.id ? { ...item, enabled: !item.enabled } : item
                    )
                  }))
                }
              >
                <Check aria-hidden="true" />
              </button>
              <button
                className="icon-button danger"
                title="Remove model"
                onClick={() =>
                  onChange((current) => {
                    const models = current.models.filter((item) => item.id !== model.id);
                    return {
                      ...current,
                      models: models.length ? models : DEFAULT_MODELS,
                      selectedModelId:
                        current.selectedModelId === model.id ? (models[0]?.id ?? DEFAULT_MODELS[0].id) : current.selectedModelId
                    };
                  })
                }
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <div className="model-row add-row">
          <input
            placeholder="Label"
            value={modelDraft.label}
            onChange={(event) => onModelDraft({ ...modelDraft, label: event.target.value })}
          />
          <input
            placeholder="Provider"
            value={modelDraft.provider}
            onChange={(event) => onModelDraft({ ...modelDraft, provider: event.target.value })}
          />
          <input
            placeholder="Model id"
            value={modelDraft.model}
            onChange={(event) => onModelDraft({ ...modelDraft, model: event.target.value })}
          />
          <button className="secondary" onClick={onAddModel}>
            <Plus aria-hidden="true" />
            Add
          </button>
        </div>
      </article>

      <div className="save-bar">
        <button className="primary" onClick={onSave} disabled={busy !== null}>
          {busy === "save" ? <Loader2 className="spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          Save settings
        </button>
      </div>
    </section>
  );
}

function RecordList({
  records,
  empty,
  onOpen,
  onBookmark
}: {
  records: PracticeRecord[];
  empty: string;
  onOpen: (record: PracticeRecord) => void;
  onBookmark: (record: PracticeRecord) => void;
}) {
  if (!records.length) {
    return (
      <section className="empty-state small">
        <CalendarClock aria-hidden="true" />
        <h2>{empty}</h2>
      </section>
    );
  }

  return (
    <section className="record-list">
      {records.map((record) => (
        <article className="record-card" key={record.id}>
          <button className="record-main" onClick={() => onOpen(record)}>
            <span>{new Date(record.createdAt).toLocaleString()}</span>
            <strong>{record.question}</strong>
            <small>
              {record.correction ? `${record.correction.mark}/10` : "Unanswered"} · {record.promptId}
            </small>
          </button>
          <button className="icon-button" onClick={() => void onBookmark(record)} title="Toggle bookmark">
            {record.bookmarked ? <BookmarkCheck /> : <Bookmark />}
          </button>
        </article>
      ))}
    </section>
  );
}

function ResultBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="result-block">
      <span>{title}</span>
      <p>{value}</p>
    </div>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function tabTitle(tab: Tab): string {
  return {
    practice: "Practice",
    history: "History",
    bookmarks: "Bookmarks",
    settings: "Settings"
  }[tab];
}
