import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
  IonContent, useIonViewWillEnter
} from '@ionic/react';
import { databaseService } from '../services/database';
import { Note } from '../types/Note';
import { colorForTag } from '../utils/tagColors';

const Favorites: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setNotes(await databaseService.getFavoriteNotes());
  }, []);

  useIonViewWillEnter(() => { load(); });

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Favorites</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '12px 16px' }}>
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => navigate(`/note/${note.id}`)}
              style={{
                background: 'var(--app-card-bg)', borderRadius: 'var(--app-card-radius)',
                padding: '14px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '110px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{note.title || 'Untitled'}</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.65, flexGrow: 1 }}>
                {note.content.slice(0, 80)}
              </p>
              {note.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {note.tags.slice(0, 2).map((tag) => {
                    const { bg, text } = colorForTag(tag);
                    return (
                      <span key={tag} style={{ background: bg, color: text, fontSize: '0.65rem', fontWeight: 600, padding: '3px 8px', borderRadius: '999px' }}>
                        {tag}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        {notes.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.5 }}>No favorites yet.</div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Favorites;