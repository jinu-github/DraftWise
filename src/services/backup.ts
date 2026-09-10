import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { databaseService } from './database';

interface BackupData {
  version: 1;
  exportedAt: string;
  notes: any[];
  folders: any[];
}

export async function createBackup(): Promise<string> {
  const notes = await databaseService.getAllNotesRaw();
  const folders = await databaseService.getAllFolders();

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes,
    folders,
  };

  const filename = `notes-backup-${Date.now()}.json`;

  await Filesystem.writeFile({
    path: filename,
    data: JSON.stringify(backup, null, 2),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  });

  return filename;
}

export async function restoreBackup(jsonContent: string): Promise<void> {
  const backup: BackupData = JSON.parse(jsonContent);

  if (!backup.notes || !backup.folders) {
    throw new Error('Invalid backup file format.');
  }

  await databaseService.wipeAllData();

  for (const folder of backup.folders) {
    await databaseService.restoreFolderRaw(folder);
  }
  for (const note of backup.notes) {
    await databaseService.restoreNoteRaw(note);
  }
}

export async function listBackups(): Promise<string[]> {
  const result = await Filesystem.readdir({ path: '', directory: Directory.Data });
  return result.files
    .map((f) => f.name)
    .filter((name) => name.startsWith('notes-backup-') && name.endsWith('.json'));
}

export async function readBackupFile(filename: string): Promise<string> {
  const result = await Filesystem.readFile({
    path: filename,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  });
  return result.data as string;
}

export async function deleteBackup(filename: string): Promise<void> {
  await Filesystem.deleteFile({ path: filename, directory: Directory.Data });
}