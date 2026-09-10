import { useEffect, useState, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
  IonContent, IonList, IonItem, IonLabel, IonSelect, IonSelectOption,
  IonAlert, IonToast, IonButton, IonIcon
} from '@ionic/react';
import { cloudUploadOutline, documentTextOutline, trash } from 'ionicons/icons';
import { databaseService } from '../services/database';
import {
  getTheme, setTheme, getDefaultSort, setDefaultSort, applyTheme,
  ThemeSetting, SortSetting
} from '../services/settings';
import { createBackup, restoreBackup, listBackups, readBackupFile, deleteBackup } from '../services/backup';
import { IonItemSliding, IonItemOptions, IonItemOption } from '@ionic/react';

function formatBackupLabel(filename: string): string {
  const match = filename.match(/-backup-(\d+)\.json/);
  if (!match) return filename;
  const date = new Date(Number(match[1]));
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const Settings: React.FC = () => {
  const [theme, setThemeState] = useState<ThemeSetting>('system');
  const [defaultSort, setDefaultSortState] = useState<SortSetting>('updated');
  const [backups, setBackups] = useState<string[]>([]);
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<string | null>(null);
  const [confirmWipeAll, setConfirmWipeAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadBackups = useCallback(async () => {
    try {
      setBackups(await listBackups());
    } catch {
      setBackups([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setThemeState(await getTheme());
      setDefaultSortState(await getDefaultSort());
    })();
    loadBackups();
  }, [loadBackups]);

  const handleThemeChange = async (value: ThemeSetting) => {
    setThemeState(value);
    await setTheme(value);
    applyTheme(value);
  };

  const handleSortChange = async (value: SortSetting) => {
    setDefaultSortState(value);
    await setDefaultSort(value);
  };

  const handleCreateBackup = async () => {
  const notes = await databaseService.getAllNotesRaw();
  const folders = await databaseService.getAllFolders();
  if (notes.length === 0 && folders.length === 0) {
    setMessage('Nothing to back up yet — add some notes first.');
    return;
  }
  try {
    const filename = await createBackup();
    setMessage(`Backup created: ${formatBackupLabel(filename)}`);
    loadBackups();
  } catch (err) {
    setMessage(err instanceof Error ? err.message : 'Backup failed');
  }
};

const handleDeleteBackup = async (filename: string) => {
  await deleteBackup(filename);
  loadBackups();
};

  const handleRestore = async () => {
    if (!confirmRestoreFile) return;
    try {
      const content = await readBackupFile(confirmRestoreFile);
      await restoreBackup(content);
      setMessage('Restore complete. Restart the app to see all changes.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setConfirmRestoreFile(null);
    }
  };

  const handleWipeAllData = async () => {
    await databaseService.wipeAllData();
    await databaseService.clearAllAiHistory();
    setMessage('All data deleted. Restart the app.');
    setConfirmWipeAll(false);
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList inset>
          <IonItem>
            <IonLabel>Theme</IonLabel>
            <IonSelect value={theme} interface="popover" onIonChange={(e) => handleThemeChange(e.detail.value)}>
              <IonSelectOption value="system">System</IonSelectOption>
              <IonSelectOption value="light">Light</IonSelectOption>
              <IonSelectOption value="dark">Dark</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonLabel>Default Sort</IonLabel>
            <IonSelect value={defaultSort} interface="popover" onIonChange={(e) => handleSortChange(e.detail.value)}>
              <IonSelectOption value="updated">Last Modified</IonSelectOption>
              <IonSelectOption value="created">Created Date</IonSelectOption>
              <IonSelectOption value="alphabetical">Alphabetical</IonSelectOption>
            </IonSelect>
          </IonItem>
        </IonList>

        <IonButton expand="block" fill="outline" onClick={handleCreateBackup} style={{ margin: '16px' }}>
          <IonIcon icon={cloudUploadOutline} slot="start" />
          Create Backup
        </IonButton>

        {backups.length > 0 && (
          <IonList inset>
            {backups.map((filename) => (
              <IonItemSliding key={filename}>
                <IonItem button onClick={() => setConfirmRestoreFile(filename)}>
                  <IonIcon icon={documentTextOutline} slot="start" color="medium" />
                  <IonLabel>{formatBackupLabel(filename)}</IonLabel>
                </IonItem>
                <IonItemOptions side="end">
                  <IonItemOption color="danger" onClick={() => handleDeleteBackup(filename)}>
                    <IonIcon icon={trash} slot="icon-only" />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
        )}

        <IonList inset>
          <IonItem button onClick={() => setConfirmWipeAll(true)}>
            <IonLabel color="danger">Delete All Data</IonLabel>
          </IonItem>
        </IonList>

        <IonAlert
          isOpen={confirmRestoreFile !== null}
          onDidDismiss={() => setConfirmRestoreFile(null)}
          header="Restore this backup?"
          message="This replaces ALL current notes and folders with the backup's contents. This can't be undone."
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            { text: 'Restore', role: 'destructive', handler: handleRestore },
          ]}
        />

        <IonAlert
          isOpen={confirmWipeAll}
          onDidDismiss={() => setConfirmWipeAll(false)}
          header="Delete everything?"
          message="This permanently deletes ALL notes and AI history. This cannot be undone. Consider creating a backup first."
          buttons={[
            { text: 'Cancel', role: 'cancel' },
            { text: 'Delete Everything', role: 'destructive', handler: handleWipeAllData },
          ]}
        />

        <IonToast isOpen={message !== null} message={message ?? ''} duration={3000} onDidDismiss={() => setMessage(null)} />
      </IonContent>

      <div style={{ textAlign: 'center', padding: '24px', opacity: 0.4, fontSize: '0.8rem' }}>
        Draftwise v1.0 (testing build)
      </div>

    </IonPage>
  );
};

export default Settings;

