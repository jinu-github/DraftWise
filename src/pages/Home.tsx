import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
  IonContent, IonIcon, IonInput, IonPopover, IonList, IonItem, IonLabel,
  useIonViewWillEnter
} from '@ionic/react';
import { add, sparkles, search, list as listIcon, albumsOutline, gridOutline, checkmark } from 'ionicons/icons';
import { databaseService, SortOption } from '../services/database';
import { getDefaultSort } from '../services/settings';
import { Note } from '../types/Note';
import { colorForTag } from '../utils/tagColors';
import { groupNotesByDate, formatRelativeTime } from '../utils/dateGroups';

const SEARCH_DEBOUNCE = 300;
type ViewMode = 'list' | 'card' | 'grid';

const Home: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [sort, setSort] = useState<SortOption>('updated');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [showViewPopover, setShowViewPopover] = useState(false);
  const navigate = useNavigate();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadNotes = useCallback(async () => {
    setNotes(await databaseService.getAllNotes(sort));
  }, [sort]);

  useEffect(() => {
    (async () => setSort(await getDefaultSort()))();
  }, []);

  useIonViewWillEnter(() => {
    if (!searchTerm) loadNotes();
  });

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setNotes(value.trim() === '' ? await databaseService.getAllNotes(sort) : await databaseService.searchNotes(value.trim()));
    }, SEARCH_DEBOUNCE);
  };

  const previewText = (content: string, len: number) =>
    content.length > len ? content.slice(0, len) + '…' : content || 'No content';

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });

  const renderTags = (tags: string[], max: number) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
      {tags.slice(0, max).map((tag) => {
        const { bg, text } = colorForTag(tag);
        return (
          <span key={tag} style={{ background: bg, color: text, fontSize: '0.65rem', fontWeight: 600, padding: '3px 8px', borderRadius: '999px' }}>
            {tag}
          </span>
        );
      })}
    </div>
  );

  const cardBaseStyle: React.CSSProperties = {
    background: 'var(--app-card-bg)',
    borderRadius: 'var(--app-card-radius)',
    boxShadow: 'var(--app-card-shadow)',
    cursor: 'pointer',
  };

  const renderList = (groups: { label: string; notes: Note[] }[]) => (
    <div style={{ padding: '4px 16px 100px' }}>
      {groups.map((group) => (
        <div key={group.label} style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 8px 4px' }}>{group.label}</h2>
          <div style={{ ...cardBaseStyle, overflow: 'hidden' }}>
            {group.notes.map((note, i) => (
              <div
                key={note.id}
                onClick={() => navigate(`/note/${note.id}`)}
                style={{
                  padding: '12px 14px',
                  borderBottom: i < group.notes.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{note.title || 'Untitled'}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{formatDate(note.updated_at)}</span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', opacity: 0.6 }}>{previewText(note.content, 50)}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCard = (groups: { label: string; notes: Note[] }[]) => (
    <div style={{ padding: '4px 16px 100px' }}>
      {groups.map((group) => (
        <div key={group.label} style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 8px 4px' }}>{group.label}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {group.notes.map((note) => (
              <div key={note.id} onClick={() => navigate(`/note/${note.id}`)} style={{ ...cardBaseStyle, padding: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{note.title || 'Untitled'}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', opacity: 0.65 }}>{previewText(note.content, 80)}</p>
                {note.tags.length > 0 && renderTags(note.tags, 3)}
                <div style={{ marginTop: '8px', fontSize: '0.7rem', opacity: 0.45 }}>{formatRelativeTime(note.updated_at)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderGrid = (allNotes: Note[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '4px 16px 100px' }}>
      {allNotes.map((note) => (
        <div key={note.id} onClick={() => navigate(`/note/${note.id}`)} style={{ ...cardBaseStyle, padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '110px' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{note.title || 'Untitled'}</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.65, flexGrow: 1 }}>{previewText(note.content, 80)}</p>
          {note.tags.length > 0 && renderTags(note.tags, 2)}
        </div>
      ))}
    </div>
  );

  const groups = groupNotesByDate(notes);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle size="large">My Notes</IonTitle>
          <IonButtons slot="end">
            <button
              onClick={(e) => setShowViewPopover(true)}
              style={{ background: 'none', border: 'none', padding: '8px', display: 'flex' }}
            >
              <IonIcon icon={viewMode === 'list' ? listIcon : viewMode === 'card' ? albumsOutline : gridOutline} style={{ fontSize: '1.3rem' }} />
            </button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonPopover isOpen={showViewPopover} onDidDismiss={() => setShowViewPopover(false)}>
        <IonList>
          {(['list', 'card', 'grid'] as ViewMode[]).map((mode) => (
            <IonItem key={mode} button onClick={() => { setViewMode(mode); setShowViewPopover(false); }}>
              <IonIcon icon={mode === 'list' ? listIcon : mode === 'card' ? albumsOutline : gridOutline} slot="start" />
              <IonLabel>{mode === 'list' ? 'List View' : mode === 'card' ? 'Card View' : 'Grid View'}</IonLabel>
              {viewMode === mode && <IonIcon icon={checkmark} slot="end" color="primary" />}
            </IonItem>
          ))}
        </IonList>
      </IonPopover>

      <IonContent>
        {notes.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.5 }}>
            {searchTerm ? 'No notes match your search.' : 'No notes yet. Tap + to create one.'}
          </div>
        ) : viewMode === 'list' ? renderList(groups) : viewMode === 'card' ? renderCard(groups) : renderGrid(notes)}
      </IonContent>

      <IonToolbar style={{
        position: 'sticky', bottom: 0,
        '--background': 'var(--ion-background-color)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
      } as React.CSSProperties}>
  <div style={{ display: 'flex', gap: '8px', padding: '10px 10px 4px', alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--app-card-bg)', borderRadius: '20px', padding: '8px 14px', boxShadow: 'var(--app-card-shadow)' }}>
            <IonIcon icon={search} style={{ opacity: 0.4, marginRight: '8px' }} />
            <IonInput
              value={searchTerm}
              placeholder="Search"
              onIonInput={(e) => handleSearchChange(e.detail.value ?? '')}
              style={{ '--padding-start': '0' } as React.CSSProperties}
            />
          </div>
          <button
            onClick={() => navigate('/ask')}
            style={{ background: 'var(--app-card-bg)', border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--app-card-shadow)' }}
          >
            <IonIcon icon={sparkles} color="primary" />
          </button>
          <button
            onClick={() => navigate('/note/new')}
            style={{ background: 'var(--ion-color-primary)', border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <IonIcon icon={add} color="light" />
          </button>
        </div>
      </IonToolbar>
    </IonPage>
  );
};

export default Home;