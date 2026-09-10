import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonContent, IonInput, IonButton, IonIcon,
  IonSpinner, IonToast, IonActionSheet, IonAlert, IonModal, IonTextarea
} from '@ionic/react';
import { pin, star, starOutline, archive, trash, copy, sparkles, time } from 'ionicons/icons';
import { databaseService } from '../services/database';
import {
  summarizeNote, generateTitleAndTags, rewriteNote, improveGrammar,
  makeShorter, makeLonger, translateNote, extractKeyPoints,
  extractActionItems, customPrompt
} from '../services/gemini';
import { colorForTag } from '../utils/tagColors';
import RichTextEditor from '../components/RichTextEditor';

const AUTOSAVE_DELAY = 800;

type ReplacementAction = 'rewrite' | 'grammar' | 'shorter' | 'longer' | 'translate' | 'custom';
type ExtractAction = 'summarize' | 'tags' | 'keypoints' | 'actionitems';

const NoteEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  const [noteId, setNoteId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loaded, setLoaded] = useState(isNew);

  const [summary, setSummary] = useState<string | null>(null);
  const [extractResult, setExtractResult] = useState<{ label: string; text: string } | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showLanguagePrompt, setShowLanguagePrompt] = useState(false);
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);

  const [previewText, setPreviewText] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{ id: number; action: string; result: string; created_at: string }[]>([]);

  const [confirmTrash, setConfirmTrash] = useState(false);

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const note = await databaseService.getNoteById(Number(id));
      if (note) {
        setNoteId(note.id);
        setTitle(note.title);
        setContent(note.content);
        setTags(note.tags);
        setIsPinned(note.is_pinned);
        setIsFavorite(note.is_favorite);
      }
      setLoaded(true);
    })();
  }, [id, isNew]);

  const scheduleSave = useCallback((newTitle: string, newContent: string) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      if (isNew && noteId === null && !newTitle.trim() && !newContent.trim()) return;
      if (noteId === null) {
        const created = await databaseService.createNote({ title: newTitle, content: newContent, tags, folder_id: null });
        setNoteId(created.id);
      } else {
        await databaseService.updateNote(noteId, { title: newTitle, content: newContent });
      }
    }, AUTOSAVE_DELAY);
  }, [isNew, noteId, tags]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    scheduleSave(value, content);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    scheduleSave(title, value);
  };

  const handleTrash = async () => {
    if (noteId !== null) await databaseService.trashNote(noteId);
    setConfirmTrash(false);
    navigate('/home');
  };

  const handleTogglePin = async () => {
    if (noteId === null) return;
    const next = !isPinned;
    setIsPinned(next);
    await databaseService.togglePin(noteId, next);
  };

  const handleToggleFavorite = async () => {
    if (noteId === null) return;
    const next = !isFavorite;
    setIsFavorite(next);
    await databaseService.toggleFavorite(noteId, next);
  };

  const handleArchive = async () => {
    if (noteId === null) return;
    await databaseService.archiveNote(noteId);
    navigate('/home');
  };

  const handleDuplicate = async () => {
    if (noteId === null) return;
    const copyNote = await databaseService.duplicateNote(noteId);
    navigate(`/note/${copyNote.id}`);
  };

  const requireContent = (): boolean => {
    if (!content.trim()) {
      setAiError('Write some content first.');
      return false;
    }
    return true;
  };

  const runExtract = async (action: ExtractAction) => {
    if (!requireContent()) return;
    setAiLoading(action);
    setAiError(null);
    try {
      if (action === 'summarize') {
        const result = await summarizeNote(content);
        setSummary(result);
        setExtractResult(null);
        if (noteId !== null) await databaseService.logAiHistory(noteId, 'Summarize', result);
      } else if (action === 'tags') {
        const result = await generateTitleAndTags(content);
        const newTitle = result.title || title;
        if (result.title) setTitle(result.title);
        setTags(result.tags);
        if (noteId === null) {
          const created = await databaseService.createNote({ title: newTitle, content, tags: result.tags, folder_id: null });
          setNoteId(created.id);
          await databaseService.logAiHistory(created.id, 'Title + Tags', `${newTitle} | ${result.tags.join(', ')}`);
        } else {
          await databaseService.updateNote(noteId, { title: newTitle, tags: result.tags });
          await databaseService.logAiHistory(noteId, 'Title + Tags', `${newTitle} | ${result.tags.join(', ')}`);
        }
      } else if (action === 'keypoints') {
        const result = await extractKeyPoints(content);
        setExtractResult({ label: 'Key Points', text: result });
        setSummary(null);
        if (noteId !== null) await databaseService.logAiHistory(noteId, 'Key Points', result);
      } else if (action === 'actionitems') {
        const result = await extractActionItems(content);
        setExtractResult({ label: 'Action Items', text: result });
        setSummary(null);
        if (noteId !== null) await databaseService.logAiHistory(noteId, 'Action Items', result);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setAiLoading(null);
    }
  };

  const runReplacement = async (action: ReplacementAction, extra?: string) => {
    if (!requireContent()) return;
    setAiLoading(action);
    setAiError(null);
    try {
      let result = '';
      let label = '';
      if (action === 'rewrite') { result = await rewriteNote(content); label = 'Rewrite'; }
      else if (action === 'grammar') { result = await improveGrammar(content); label = 'Improve Grammar'; }
      else if (action === 'shorter') { result = await makeShorter(content); label = 'Make Shorter'; }
      else if (action === 'longer') { result = await makeLonger(content); label = 'Make Longer'; }
      else if (action === 'translate' && extra) { result = await translateNote(content, extra); label = `Translate (${extra})`; }
      else if (action === 'custom' && extra) { result = await customPrompt(content, extra); label = `Custom: ${extra}`; }
      setPreviewText(result);
      if (noteId !== null && label) await databaseService.logAiHistory(noteId, label, result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setAiLoading(null);
    }
  };

  const applyPreview = () => {
    if (previewText === null) return;
    setContent(previewText);
    scheduleSave(title, previewText);
    setPreviewText(null);
  };

  const loadHistory = async () => {
    if (noteId === null) return;
    setHistory(await databaseService.getAiHistoryForNote(noteId));
  };

  const handleOpenHistory = async () => {
    await loadHistory();
    setShowHistory(true);
  };

  const handleDeleteHistoryEntry = async (id: number) => {
    await databaseService.deleteAiHistoryEntry(id);
    loadHistory();
  };

  const handleClearHistory = async () => {
    if (noteId === null) return;
    await databaseService.clearAiHistoryForNote(noteId);
    loadHistory();
  };

  if (!loaded) return null;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" text="" />
          </IonButtons>
          {noteId !== null && (
            <IonButtons slot="end">
              <IonButton onClick={handleTogglePin}>
                <IonIcon icon={pin} slot="icon-only" color={isPinned ? 'primary' : 'medium'} />
              </IonButton>
              <IonButton onClick={handleToggleFavorite}>
                <IonIcon icon={isFavorite ? star : starOutline} slot="icon-only" color={isFavorite ? 'warning' : 'medium'} />
              </IonButton>
              <IonButton onClick={handleDuplicate}>
                <IonIcon icon={copy} slot="icon-only" />
              </IonButton>
              <IonButton onClick={handleOpenHistory}>
                <IonIcon icon={time} slot="icon-only" />
              </IonButton>
              <IonButton onClick={handleArchive}>
                <IonIcon icon={archive} slot="icon-only" />
              </IonButton>
              <IonButton onClick={() => setConfirmTrash(true)}>
                <IonIcon icon={trash} slot="icon-only" />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '4px' }}>
          {new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>

        <IonInput
          value={title}
          placeholder="Title"
          onIonInput={(e) => handleTitleChange(e.detail.value ?? '')}
          style={{ fontSize: '1.5rem', fontWeight: 700, '--padding-start': '0' } as React.CSSProperties}
        />

        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '10px 0' }}>
            {tags.map((tag) => {
              const { bg, text } = colorForTag(tag);
              return (
                <span key={tag} style={{ background: bg, color: text, fontSize: '0.7rem', fontWeight: 600, padding: '4px 10px', borderRadius: '999px' }}>
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        <RichTextEditor content={content} onChange={handleContentChange} placeholder="Start writing..." />

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          <IonButton fill="solid" size="small" shape="round" onClick={() => setShowActionSheet(true)} disabled={aiLoading !== null}>
            {aiLoading ? <IonSpinner name="dots" /> : (<><IonIcon icon={sparkles} slot="start" />AI Actions</>)}
          </IonButton>
        </div>

        {summary && (
          <div style={{ marginTop: '1rem', padding: '12px 14px', background: 'var(--app-card-bg)', borderRadius: 'var(--app-card-radius)' }}>
            <strong style={{ fontSize: '0.85rem' }}>Summary</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem', opacity: 0.8, whiteSpace: 'pre-wrap' }}>{summary}</p>
          </div>
        )}

        {extractResult && (
          <div style={{ marginTop: '1rem', padding: '12px 14px', background: 'var(--app-card-bg)', borderRadius: 'var(--app-card-radius)' }}>
            <strong style={{ fontSize: '0.85rem' }}>{extractResult.label}</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem', opacity: 0.8, whiteSpace: 'pre-wrap' }}>{extractResult.text}</p>
          </div>
        )}

        <IonActionSheet
          isOpen={showActionSheet}
          onDidDismiss={() => setShowActionSheet(false)}
          header="AI Actions"
          buttons={[
            { text: 'Summarize', handler: () => runExtract('summarize') },
            { text: 'Generate Title + Tags', handler: () => runExtract('tags') },
            { text: 'Extract Key Points', handler: () => runExtract('keypoints') },
            { text: 'Custom Prompt...', handler: () => setShowCustomPrompt(true) },
            { text: 'Cancel', role: 'cancel' },
          ]}
        />

        <IonAlert
          isOpen={showLanguagePrompt}
          onDidDismiss={() => setShowLanguagePrompt(false)}
          header="Translate to..."
          inputs={[{ name: 'language', type: 'text', placeholder: 'e.g. Spanish, Tagalog, Japanese' }]}
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            { text: 'Translate', handler: (data) => data.language?.trim() && runReplacement('translate', data.language.trim()) },
          ]}
        />

        <IonAlert
          isOpen={showCustomPrompt}
          onDidDismiss={() => setShowCustomPrompt(false)}
          header="Custom AI Instruction"
          inputs={[{ name: 'instruction', type: 'text', placeholder: 'e.g. Turn this into a formal email' }]}
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            { text: 'Run', handler: (data) => data.instruction?.trim() && runReplacement('custom', data.instruction.trim()) },
          ]}
        />

        <IonAlert
          isOpen={confirmTrash}
          onDidDismiss={() => setConfirmTrash(false)}
          header="Move to trash?"
          message="You can restore this note later from Trash."
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            { text: 'Delete', role: 'destructive', handler: handleTrash },
          ]}
        />

        <IonModal isOpen={previewText !== null} onDidDismiss={() => setPreviewText(null)}>
          <IonHeader>
            <IonToolbar>
              <IonButtons slot="start">
                <IonButton onClick={() => setPreviewText(null)}>Discard</IonButton>
              </IonButtons>
              <IonButtons slot="end">
                <IonButton onClick={applyPreview} strong>Apply</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonTextarea value={previewText ?? ''} readonly autoGrow />
          </IonContent>
        </IonModal>

        <IonModal isOpen={showHistory} onDidDismiss={() => setShowHistory(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>AI History</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowHistory(false)}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {history.length === 0 && <p style={{ opacity: 0.5, textAlign: 'center' }}>No AI actions yet on this note.</p>}
            {history.map((entry) => (
              <div key={entry.id} style={{ marginBottom: '12px', padding: '10px', background: 'var(--app-card-bg)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.85rem' }}>{entry.action}</strong>
                  <IonIcon icon={trash} onClick={() => handleDeleteHistoryEntry(entry.id)} style={{ opacity: 0.5, cursor: 'pointer' }} />
                </div>
                <p style={{ fontSize: '0.75rem', opacity: 0.5, margin: '2px 0 6px' }}>
                  {new Date(entry.created_at).toLocaleString()}
                </p>
                <p style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap', margin: 0 }}>{entry.result}</p>
              </div>
            ))}
            {history.length > 0 && (
              <IonButton expand="block" fill="outline" color="danger" onClick={handleClearHistory}>
                Clear All History
              </IonButton>
            )}
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={aiError !== null}
          message={aiError ?? ''}
          duration={3000}
          onDidDismiss={() => setAiError(null)}
          color="danger"
        />
      </IonContent>
    </IonPage>
  );
};

export default NoteEditor;