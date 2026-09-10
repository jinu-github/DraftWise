import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Note, NewNote, Folder } from '../types/Note';

const DB_NAME = 'note_db';

export type SortOption = 'updated' | 'created' | 'alphabetical';

class DatabaseService {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  async init(): Promise<void> {
    const ret = await this.sqlite.checkConnectionsConsistency();
    const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;

    if (ret.result && isConn) {
      this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
    } else {
      this.db = await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    }

    await this.db.open();

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        folder_id INTEGER DEFAULT NULL,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT DEFAULT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS ai_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    await this.migrateColumnIfMissing('tags', "TEXT NOT NULL DEFAULT '[]'");
    await this.migrateColumnIfMissing('folder_id', 'INTEGER DEFAULT NULL');
    await this.migrateColumnIfMissing('is_pinned', 'INTEGER NOT NULL DEFAULT 0');
    await this.migrateColumnIfMissing('is_favorite', 'INTEGER NOT NULL DEFAULT 0');
    await this.migrateColumnIfMissing('is_archived', 'INTEGER NOT NULL DEFAULT 0');
    await this.migrateColumnIfMissing('deleted_at', 'TEXT DEFAULT NULL');
  }

  private ensureDb(): SQLiteDBConnection {
    if (!this.db) throw new Error('Database not initialized. Call init() first.');
    return this.db;
  }

  private async migrateColumnIfMissing(column: string, definition: string): Promise<void> {
    const db = this.ensureDb();
    const tableInfo = await db.query(`PRAGMA table_info(notes);`);
    const columns = (tableInfo.values as { name: string }[]) ?? [];
    const exists = columns.some((col) => col.name === column);
    if (!exists) {
      await db.execute(`ALTER TABLE notes ADD COLUMN ${column} ${definition};`);
    }
  }

  private rowToNote(row: any): Note {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags ?? '[]'),
      folder_id: row.folder_id ?? null,
      is_pinned: !!row.is_pinned,
      is_favorite: !!row.is_favorite,
      is_archived: !!row.is_archived,
      deleted_at: row.deleted_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private sortClause(sort: SortOption): string {
    switch (sort) {
      case 'created': return 'created_at DESC';
      case 'alphabetical': return 'title COLLATE NOCASE ASC';
      default: return 'updated_at DESC';
    }
  }

  async getAllNotes(sort: SortOption = 'updated', folderId?: number | null): Promise<Note[]> {
    const db = this.ensureDb();
    let query = `SELECT * FROM notes WHERE deleted_at IS NULL AND is_archived = 0`;
    const params: number[] = [];

    if (folderId !== undefined && folderId !== null) {
      query += ` AND folder_id = ?`;
      params.push(folderId);
    }

    query += ` ORDER BY is_pinned DESC, ${this.sortClause(sort)}`;

    const result = await db.query(query, params);
    return ((result.values as any[]) ?? []).map((row) => this.rowToNote(row));
  }

  async getArchivedNotes(): Promise<Note[]> {
    const db = this.ensureDb();
    const result = await db.query(
      `SELECT * FROM notes WHERE deleted_at IS NULL AND is_archived = 1 ORDER BY updated_at DESC`
    );
    return ((result.values as any[]) ?? []).map((row) => this.rowToNote(row));
  }

  async getTrashedNotes(): Promise<Note[]> {
    const db = this.ensureDb();
    const result = await db.query(
      `SELECT * FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
    );
    return ((result.values as any[]) ?? []).map((row) => this.rowToNote(row));
  }

  async getFavoriteNotes(): Promise<Note[]> {
    const db = this.ensureDb();
    const result = await db.query(
      `SELECT * FROM notes WHERE deleted_at IS NULL AND is_archived = 0 AND is_favorite = 1
       ORDER BY updated_at DESC`
    );
    return ((result.values as any[]) ?? []).map((row) => this.rowToNote(row));
  }

  async getNoteById(id: number): Promise<Note | null> {
    const db = this.ensureDb();
    const result = await db.query(`SELECT * FROM notes WHERE id = ?`, [id]);
    const rows = result.values as any[];
    return rows?.[0] ? this.rowToNote(rows[0]) : null;
  }

  async searchNotes(query: string): Promise<Note[]> {
    const db = this.ensureDb();
    const term = `%${query.toLowerCase()}%`;
    const result = await db.query(
      `SELECT * FROM notes
       WHERE deleted_at IS NULL
         AND (LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(tags) LIKE ?)
       ORDER BY is_pinned DESC, updated_at DESC`,
      [term, term, term]
    );
    return ((result.values as any[]) ?? []).map((row) => this.rowToNote(row));
  }

  async searchNotesForContext(question: string): Promise<Note[]> {
    const db = this.ensureDb();

    // Pull out words 3+ chars, skip common stopwords
    const stopwords = new Set(['the', 'and', 'for', 'what', 'did', 'write', 'about', 'have', 'with', 'that', 'this']);
    const keywords = question
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopwords.has(w));

    if (keywords.length === 0) return [];

    const conditions = keywords.map(() => `(LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(tags) LIKE ?)`).join(' OR ');
    const params: string[] = [];
    keywords.forEach((kw) => {
      const term = `%${kw}%`;
      params.push(term, term, term);
    });

    const result = await db.query(
      `SELECT * FROM notes WHERE deleted_at IS NULL AND (${conditions}) ORDER BY updated_at DESC LIMIT 8`,
      params
    );
    return ((result.values as any[]) ?? []).map((row) => this.rowToNote(row));
  }

  async createNote(note: NewNote): Promise<Note> {
    const db = this.ensureDb();
    const now = new Date().toISOString();
    const tagsJson = JSON.stringify(note.tags ?? []);

    const result = await db.run(
      `INSERT INTO notes (title, content, tags, folder_id, is_pinned, is_favorite, is_archived, deleted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, 0, NULL, ?, ?)`,
      [note.title, note.content, tagsJson, note.folder_id ?? null, now, now]
    );

    const id = result.changes?.lastId;
    if (!id) throw new Error('Failed to create note');

    return {
      id, title: note.title, content: note.content, tags: note.tags ?? [],
      folder_id: note.folder_id ?? null,
      is_pinned: false, is_favorite: false, is_archived: false, deleted_at: null,
      created_at: now, updated_at: now,
    };
  }

  async updateNote(id: number, updates: Partial<NewNote>): Promise<void> {
    const db = this.ensureDb();
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
    if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
    if (updates.folder_id !== undefined) { fields.push('folder_id = ?'); values.push(updates.folder_id); }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await db.run(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async setNoteFolder(id: number, folderId: number | null): Promise<void> {
    const db = this.ensureDb();
    await db.run(`UPDATE notes SET folder_id = ? WHERE id = ?`, [folderId, id]);
  }

  async togglePin(id: number, pinned: boolean): Promise<void> {
    const db = this.ensureDb();
    await db.run(`UPDATE notes SET is_pinned = ? WHERE id = ?`, [pinned ? 1 : 0, id]);
  }

  async toggleFavorite(id: number, favorite: boolean): Promise<void> {
    const db = this.ensureDb();
    await db.run(`UPDATE notes SET is_favorite = ? WHERE id = ?`, [favorite ? 1 : 0, id]);
  }

  async archiveNote(id: number): Promise<void> {
    const db = this.ensureDb();
    await db.run(`UPDATE notes SET is_archived = 1 WHERE id = ?`, [id]);
  }

  async restoreFromArchive(id: number): Promise<void> {
    const db = this.ensureDb();
    await db.run(`UPDATE notes SET is_archived = 0 WHERE id = ?`, [id]);
  }

  async trashNote(id: number): Promise<void> {
    const db = this.ensureDb();
    const now = new Date().toISOString();
    await db.run(`UPDATE notes SET deleted_at = ? WHERE id = ?`, [now, id]);
  }

  async restoreFromTrash(id: number): Promise<void> {
    const db = this.ensureDb();
    await db.run(`UPDATE notes SET deleted_at = NULL WHERE id = ?`, [id]);
  }

  async permanentlyDeleteNote(id: number): Promise<void> {
    const db = this.ensureDb();
    await db.run(`DELETE FROM notes WHERE id = ?`, [id]);
  }

  async duplicateNote(id: number): Promise<Note> {
    const original = await this.getNoteById(id);
    if (!original) throw new Error('Note not found');

    return this.createNote({
      title: original.title ? `${original.title} (Copy)` : '',
      content: original.content,
      tags: original.tags,
      folder_id: original.folder_id,
    });
  }

  // --- Folders ---

  async getAllFolders(): Promise<Folder[]> {
    const db = this.ensureDb();
    const result = await db.query(`SELECT * FROM folders ORDER BY name COLLATE NOCASE ASC`);
    return (result.values as Folder[]) ?? [];
  }

  async createFolder(name: string): Promise<Folder> {
    const db = this.ensureDb();
    const now = new Date().toISOString();
    const result = await db.run(`INSERT INTO folders (name, created_at) VALUES (?, ?)`, [name, now]);
    const id = result.changes?.lastId;
    if (!id) throw new Error('Failed to create folder');
    return { id, name, created_at: now };
  }

  async deleteFolder(id: number): Promise<void> {
    const db = this.ensureDb();
    await db.run(`UPDATE notes SET folder_id = NULL WHERE folder_id = ?`, [id]);
    await db.run(`DELETE FROM folders WHERE id = ?`, [id]);
  }

  // --- Backup / Restore ---

  async getAllNotesRaw(): Promise<Note[]> {
    const db = this.ensureDb();
    const result = await db.query(`SELECT * FROM notes`);
    return ((result.values as any[]) ?? []).map((row) => this.rowToNote(row));
  }

  async wipeAllData(): Promise<void> {
    const db = this.ensureDb();
    await db.execute(`DELETE FROM notes;`);
    await db.execute(`DELETE FROM folders;`);
  }

  async restoreNoteRaw(note: Note): Promise<void> {
    const db = this.ensureDb();
    await db.run(
      `INSERT INTO notes (id, title, content, tags, folder_id, is_pinned, is_favorite, is_archived, deleted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        note.id, note.title, note.content, JSON.stringify(note.tags), note.folder_id,
        note.is_pinned ? 1 : 0, note.is_favorite ? 1 : 0, note.is_archived ? 1 : 0,
        note.deleted_at, note.created_at, note.updated_at,
      ]
    );
  }

  async restoreFolderRaw(folder: Folder): Promise<void> {
    const db = this.ensureDb();
    await db.run(`INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)`, [folder.id, folder.name, folder.created_at]);
  }

  // --- AI History ---

  async logAiHistory(noteId: number, action: string, result: string): Promise<void> {
    const db = this.ensureDb();
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO ai_history (note_id, action, result, created_at) VALUES (?, ?, ?, ?)`,
      [noteId, action, result, now]
    );
  }

  async getAiHistoryForNote(noteId: number): Promise<{ id: number; action: string; result: string; created_at: string }[]> {
    const db = this.ensureDb();
    const result = await db.query(
      `SELECT * FROM ai_history WHERE note_id = ? ORDER BY created_at DESC`,
      [noteId]
    );
    return (result.values as any[]) ?? [];
  }

  async deleteAiHistoryEntry(id: number): Promise<void> {
    const db = this.ensureDb();
    await db.run(`DELETE FROM ai_history WHERE id = ?`, [id]);
  }

  async clearAiHistoryForNote(noteId: number): Promise<void> {
    const db = this.ensureDb();
    await db.run(`DELETE FROM ai_history WHERE note_id = ?`, [noteId]);
  }

  async clearAllAiHistory(): Promise<void> {
  const db = this.ensureDb();
  await db.execute(`DELETE FROM ai_history;`);
  }
}

export const databaseService = new DatabaseService();