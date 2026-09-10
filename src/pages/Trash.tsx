import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
  IonContent, IonIcon, IonAlert, useIonViewWillEnter
} from '@ionic/react';
import { arrowUndoOutline, trashBinOutline } from 'ionicons/icons';
import { databaseService } from '../services/database';
import { Note } from '../types/Note';

const Trash: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setNotes(await databaseService.getTrashedNotes());
  }, []);

  useIonViewWillEnter(() => { load(); });

  const handleRestore = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await databaseService.restoreFromTrash(id);
    load();
  };

  const handlePermanentDelete = async () => {
    if (confirmDeleteId !== null) {
      await databaseService.permanentlyDeleteNote(confirmDeleteId);
      setConfirmDeleteId(null);
      load();
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Trash</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 16px' }}>
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => navigate(`/note/${note.id}`)}
              style={{
                background: 'var(--app-card-bg)', borderRadius: 'var(--app-card-radius)',
                padding: '14px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{note.title || 'Untitled'}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.6 }}>
                  {note.content.slice(0, 60)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <IonIcon
                  icon={arrowUndoOutline}
                  onClick={(e) => handleRestore(e, note.id)}
                  style={{ fontSize: '1.3rem', padding: '8px' }}
                />
                <IonIcon
                  icon={trashBinOutline}
                  color="danger"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(note.id); }}
                  style={{ fontSize: '1.3rem', padding: '8px' }}
                />
              </div>
            </div>
          ))}
          {notes.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.5 }}>Trash is empty.</div>
          )}
        </div>

        <IonAlert
          isOpen={confirmDeleteId !== null}
          onDidDismiss={() => setConfirmDeleteId(null)}
          header="Delete permanently?"
          message="This can't be undone."
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            { text: 'Delete', role: 'destructive', handler: handlePermanentDelete },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default Trash;