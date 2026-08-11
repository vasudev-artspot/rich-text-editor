import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./App.css";
import { MediaPicker } from "./components/MediaPicker";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "./components/RichTextEditor";
import {
  getStoryMedia,
  StoryPreview,
} from "./components/StoryPreview";
import { CONTENT_SERVICE_URL, IMAGE_PREFIX_URL } from "./config";
import {
  deriveAuthorName,
  getCookieToken,
  getEffectiveAccessToken,
  getSessionAuthorName,
  getSessionShopId,
  getSessionToken,
  setSessionAuthorName,
  setSessionShopId,
  setSessionToken,
} from "./services/auth";
import {
  buildCreateStoryInput,
  buildUpdateStoryInput,
  createStory,
  fetchPublicShopStories,
  fetchStoryById,
  fetchTopics,
  StoryApiError,
  updateStory,
  uploadStoryFiles,
} from "./services/storyApi";
import type {
  MediaNode,
  Story,
  StoryFormValues,
  StoryStatus,
  Topic,
} from "./types/story";

type EditorMode = "create" | "edit";

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
};

const positiveInteger = (value: string, label: string): number => {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new StoryApiError(`${label} must be a positive integer.`);
  }
  return parsed;
};

const mediaUrl = (media: MediaNode): string => {
  if (media.cdnUrl?.trim()) return media.cdnUrl.trim();
  const prefix = IMAGE_PREFIX_URL.replace(/\/$/, "");
  return prefix && media.guid ? `${prefix}/s/${media.guid}_1024.webp` : "";
};

export default function App() {
  const editorRef = useRef<RichTextEditorHandle>(null);

  const [manualToken, setManualTokenState] = useState(getSessionToken);
  const [cookieToken, setCookieToken] = useState(getCookieToken);
  const effectiveAuth = useMemo(
    () => getEffectiveAccessToken(manualToken, cookieToken),
    [cookieToken, manualToken],
  );

  const [shopId, setShopIdState] = useState(getSessionShopId);
  const [authorName, setAuthorNameState] = useState(() => {
    const stored = getSessionAuthorName();
    return stored || deriveAuthorName(effectiveAuth.token);
  });

  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [mode, setMode] = useState<EditorMode>("create");
  const [editingStoryId, setEditingStoryId] = useState<number | null>(null);
  const [storyIdInput, setStoryIdInput] = useState("");
  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState("");
  const [existingMedia, setExistingMedia] = useState<MediaNode[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [directStory, setDirectStory] = useState<Story | null>(null);
  const [publicStory, setPublicStory] = useState<Story | null>(null);
  const [publicChecked, setPublicChecked] = useState(false);
  const [lastSubmittedStatus, setLastSubmittedStatus] =
    useState<StoryStatus | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isBusy = Boolean(busy);

  useEffect(() => {
    if (!authorName && effectiveAuth.token) {
      const derived = deriveAuthorName(effectiveAuth.token);
      if (derived) {
        setAuthorNameState(derived);
        setSessionAuthorName(derived);
      }
    }
  }, [authorName, effectiveAuth.token]);

  const loadTopics = useCallback(async () => {
    if (!CONTENT_SERVICE_URL) return;
    setTopicsLoading(true);
    try {
      setTopics(await fetchTopics(CONTENT_SERVICE_URL, effectiveAuth.token));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setTopicsLoading(false);
    }
  }, [effectiveAuth.token]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  const setManualToken = (value: string) => {
    setManualTokenState(value);
    setSessionToken(value);
  };

  const setShopId = (value: string) => {
    setShopIdState(value);
    setSessionShopId(value);
  };

  const setAuthorName = (value: string) => {
    setAuthorNameState(value);
    setSessionAuthorName(value);
  };

  const clearMessages = () => {
    setError("");
    setNotice("");
  };

  const validateStoryForm = (): StoryFormValues => {
    if (!effectiveAuth.token) {
      throw new StoryApiError(
        "A seller access token is required. Sign in to the shop app on localhost or paste a token in Connection settings.",
      );
    }
    if (!title.trim()) throw new StoryApiError("Story title is required.");
    positiveInteger(shopId, "Shop ID");
    positiveInteger(topicId, "Topic");

    const editor = editorRef.current;
    if (!editor) throw new StoryApiError("The editor is not ready yet.");
    if (editor.getText().trim().length < 10) {
      throw new StoryApiError("Story content must contain at least 10 characters.");
    }

    return {
      title,
      content: editor.getHTML(),
      topicId,
      shopId,
      authorName,
      mediaGuids: existingMedia.map((media) => media.guid),
    };
  };

  const uploadPending = async (): Promise<MediaNode[]> => {
    if (pendingFiles.length === 0) return existingMedia;
    const uploaded = await uploadStoryFiles(
      CONTENT_SERVICE_URL,
      effectiveAuth.token,
      pendingFiles,
    );
    const uploadedNodes = uploaded.map<MediaNode>((media) => ({
      guid: media.guid,
    }));
    const nextMedia = [...existingMedia, ...uploadedNodes];
    setExistingMedia(nextMedia);
    setPendingFiles([]);
    return nextMedia;
  };

  const refreshPublicStory = async (storyId: number): Promise<Story | null> => {
    const validatedShopId = String(positiveInteger(shopId, "Shop ID"));
    const groups = await fetchPublicShopStories(
      CONTENT_SERVICE_URL,
      validatedShopId,
      effectiveAuth.token,
    );
    const found =
      groups.flatMap((group) => group.stories).find((story) => Number(story.id) === storyId) ??
      null;
    setPublicStory(found);
    setPublicChecked(true);
    return found;
  };

  const refreshAfterMutation = async (
    storyId: number,
  ): Promise<string> => {
    const story = await fetchStoryById(
      CONTENT_SERVICE_URL,
      storyId,
      effectiveAuth.token,
    );
    setDirectStory(story);

    try {
      await refreshPublicStory(storyId);
      return "";
    } catch (publicError) {
      setPublicChecked(false);
      setPublicStory(null);
      return ` Public view refresh failed: ${errorMessage(publicError)}`;
    }
  };

  const handleCreate = async (status: StoryStatus) => {
    clearMessages();
    setBusy(status === "DRAFT" ? "Creating draft…" : "Publishing Story…");
    try {
      const baseForm = validateStoryForm();
      const allMedia = await uploadPending();
      const input = buildCreateStoryInput(
        { ...baseForm, mediaGuids: allMedia.map((media) => media.guid) },
        status,
      );
      const created = await createStory(
        CONTENT_SERVICE_URL,
        effectiveAuth.token,
        input,
      );
      setStoryIdInput(String(created.id));
      setLastSubmittedStatus(status);
      const warning = await refreshAfterMutation(created.id);
      setNotice(
        `Story #${created.id} ${status === "DRAFT" ? "was created as a draft" : "was published"}.${warning}`,
      );
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setBusy("");
    }
  };

  const handleUpdate = async (status: StoryStatus) => {
    clearMessages();
    setBusy(status === "DRAFT" ? "Saving draft…" : "Publishing update…");
    try {
      if (!editingStoryId) {
        throw new StoryApiError("Load a Story into the editor before updating it.");
      }
      const baseForm = validateStoryForm();
      const allMedia = await uploadPending();
      const input = buildUpdateStoryInput(
        editingStoryId,
        { ...baseForm, mediaGuids: allMedia.map((media) => media.guid) },
        status,
      );
      await updateStory(CONTENT_SERVICE_URL, effectiveAuth.token, input);
      setLastSubmittedStatus(status);
      const warning = await refreshAfterMutation(editingStoryId);
      setNotice(
        `Story #${editingStoryId} ${status === "DRAFT" ? "was saved as a draft" : "was published"}.${warning}`,
      );
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setBusy("");
    }
  };

  const fetchSelectedStory = async (): Promise<Story | null> => {
    const id = positiveInteger(storyIdInput, "Story ID");
    const story = await fetchStoryById(
      CONTENT_SERVICE_URL,
      id,
      effectiveAuth.token,
    );
    setDirectStory(story);
    setPublicChecked(false);
    setPublicStory(null);
    return story;
  };

  const handleFetchStory = async () => {
    clearMessages();
    setBusy("Fetching Story…");
    try {
      const story = await fetchSelectedStory();
      if (story) setNotice(`Fetched Story #${story.id}.`);
    } catch (fetchError) {
      setError(errorMessage(fetchError));
    } finally {
      setBusy("");
    }
  };

  const hydrateEditor = (story: Story) => {
    setMode("edit");
    setEditingStoryId(Number(story.id));
    setStoryIdInput(String(story.id));
    setTitle(story.title ?? "");
    setTopicId(story.topic?.id ? String(story.topic.id) : "");
    setExistingMedia(getStoryMedia(story));
    setPendingFiles([]);
    editorRef.current?.setContent(story.content);
    setNotice(`Story #${story.id} is loaded for editing.`);
    setError("");
  };

  const handleLoadForEdit = async () => {
    clearMessages();
    setBusy("Loading editor…");
    try {
      const requestedId = positiveInteger(storyIdInput, "Story ID");
      const story =
        directStory && Number(directStory.id) === requestedId
          ? directStory
          : await fetchSelectedStory();
      if (story) hydrateEditor(story);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setBusy("");
    }
  };

  const handleRefreshPublic = async () => {
    clearMessages();
    setBusy("Refreshing public view…");
    try {
      const id = positiveInteger(storyIdInput, "Story ID");
      const story = await refreshPublicStory(id);
      setNotice(
        story
          ? `Story #${id} is present in the public shop feed.`
          : `Story #${id} is not currently present in the public shop feed.`,
      );
    } catch (refreshError) {
      setPublicChecked(false);
      setError(errorMessage(refreshError));
    } finally {
      setBusy("");
    }
  };

  const startNewStory = () => {
    clearMessages();
    setMode("create");
    setEditingStoryId(null);
    setStoryIdInput("");
    setTitle("");
    setTopicId("");
    setExistingMedia([]);
    setPendingFiles([]);
    setDirectStory(null);
    setPublicStory(null);
    setPublicChecked(false);
    setLastSubmittedStatus(null);
    editorRef.current?.clear();
  };

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Real API proof of concept</p>
          <h1>Story lifecycle editor</h1>
          <p>
            Create, fetch, render, edit, and republish Stories through the production
            GraphQL contract.
          </p>
        </div>
        <span className="badge">TipTap + React 19</span>
      </header>

      {!CONTENT_SERVICE_URL && (
        <div className="alert error">
          VITE_CONTENT_SERVICE_URL is missing. Copy .env.example to .env.local and
          restart Vite.
        </div>
      )}
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}
      {busy && <div className="busy-banner">{busy}</div>}

      <section className="panel connection-panel">
        <div className="section-heading">
          <div>
            <p className="step">Connection</p>
            <h2>Seller session and shop</h2>
          </div>
          <span className={`auth-state ${effectiveAuth.source}`}>
            {effectiveAuth.source === "cookie"
              ? "Using shop cookie"
              : effectiveAuth.source === "session"
                ? "Using session token"
                : "Token required for writes"}
          </span>
        </div>

        <div className="settings-grid">
          <label className="field wide">
            <span>GraphQL endpoint</span>
            <input value={CONTENT_SERVICE_URL} readOnly />
          </label>
          <label className="field">
            <span>Shop ID</span>
            <input
              inputMode="numeric"
              value={shopId}
              onChange={(event) => setShopId(event.target.value)}
              placeholder="Numeric shop ID"
            />
          </label>
          <label className="field">
            <span>Author name</span>
            <input
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder="Derived from seller JWT"
            />
          </label>
          <label className="field wide">
            <span>Manual token override</span>
            <div className="inline-field">
              <input
                type="password"
                autoComplete="off"
                value={manualToken}
                onChange={(event) => setManualToken(event.target.value)}
                placeholder={cookieToken ? "Shop cookie detected" : "Paste seller access token"}
              />
              <button
                type="button"
                className="secondary-button"
                onClick={() => setManualToken("")}
                disabled={!manualToken}
              >
                Clear override
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCookieToken(getCookieToken())}
              >
                Refresh cookie
              </button>
            </div>
            <small>The override is retained only for this browser session.</small>
          </label>
        </div>
      </section>

      <section className="panel lookup-panel">
        <div>
          <p className="step">Fetch</p>
          <h2>Open an existing Story</h2>
        </div>
        <div className="lookup-actions">
          <input
            aria-label="Story ID"
            inputMode="numeric"
            value={storyIdInput}
            onChange={(event) => setStoryIdInput(event.target.value)}
            placeholder="Story ID"
          />
          <button type="button" className="secondary-button" disabled={isBusy} onClick={handleFetchStory}>
            Fetch detail
          </button>
          <button type="button" className="secondary-button" disabled={isBusy} onClick={handleRefreshPublic}>
            Check public view
          </button>
          <button type="button" className="primary-button" disabled={isBusy} onClick={handleLoadForEdit}>
            Load for edit
          </button>
        </div>
      </section>

      <section className="panel editor-panel">
        <div className="section-heading">
          <div>
            <p className="step">{mode === "create" ? "Create" : "Edit"}</p>
            <h2>
              {mode === "create"
                ? "Compose a new Story"
                : `Editing Story #${editingStoryId ?? ""}`}
            </h2>
          </div>
          {mode === "edit" && (
            <button type="button" className="secondary-button" onClick={startNewStory} disabled={isBusy}>
              New Story
            </button>
          )}
        </div>

        <div className="form-grid">
          <label className="field wide">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Story title"
              disabled={isBusy}
            />
          </label>
          <label className="field wide">
            <span>Topic</span>
            <select
              value={topicId}
              onChange={(event) => setTopicId(event.target.value)}
              disabled={isBusy || topicsLoading}
            >
              <option value="">
                {topicsLoading ? "Loading topics…" : "Select a topic"}
              </option>
              {topics.map((topic) => (
                <option key={String(topic.id)} value={String(topic.id)}>
                  {topic.name}
                </option>
              ))}
            </select>
            {topics.length === 0 && !topicsLoading && (
              <button type="button" className="text-button" onClick={() => void loadTopics()}>
                Retry loading topics
              </button>
            )}
          </label>
        </div>

        <div className="editor-label">
          <span>Content</span>
          <small>Minimum 10 visible characters</small>
        </div>
        <RichTextEditor ref={editorRef} disabled={isBusy} initialContent="" />

        <MediaPicker
          disabled={isBusy}
          existingMedia={existingMedia}
          pendingFiles={pendingFiles}
          imageUrl={mediaUrl}
          onError={setError}
          onExistingMediaChange={setExistingMedia}
          onPendingFilesChange={setPendingFiles}
        />

        <div className="form-actions">
          {mode === "create" ? (
            <>
              <button type="button" className="secondary-button" disabled={isBusy} onClick={() => void handleCreate("DRAFT")}>
                Create Draft
              </button>
              <button type="button" className="primary-button" disabled={isBusy} onClick={() => void handleCreate("PUBLISHED")}>
                Create &amp; Publish
              </button>
            </>
          ) : (
            <>
              <button type="button" className="secondary-button" disabled={isBusy} onClick={() => void handleUpdate("DRAFT")}>
                Save as Draft
              </button>
              <button type="button" className="primary-button" disabled={isBusy} onClick={() => void handleUpdate("PUBLISHED")}>
                Publish Update
              </button>
            </>
          )}
        </div>
      </section>

      <section className="verification-section">
        <div className="verification-heading">
          <div>
            <p className="step">Verify</p>
            <h2>Saved Story output</h2>
          </div>
          <p>Direct detail is authoritative; the public feed is expected to omit drafts.</p>
        </div>

        <div className="preview-grid">
          <div className="preview-slot">
            {directStory ? (
              <>
                <StoryPreview label="storyById" story={directStory} imageUrl={mediaUrl} />
                <button type="button" className="text-button edit-preview" onClick={() => hydrateEditor(directStory)}>
                  Edit this Story
                </button>
              </>
            ) : (
              <div className="empty-preview">Create or fetch a Story to see its direct API result.</div>
            )}
          </div>

          <div className="preview-slot">
            {publicStory ? (
              <StoryPreview label="shopById.topicStories" story={publicStory} imageUrl={mediaUrl} />
            ) : publicChecked ? (
              <div className="empty-preview">
                {lastSubmittedStatus === "DRAFT"
                  ? "This draft is correctly absent from the public shop feed."
                  : "The Story is not in the public shop feed yet. Publish it or retry after the backend refreshes."}
              </div>
            ) : (
              <div className="empty-preview">Run “Check public view” to query the storefront Story feed.</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
