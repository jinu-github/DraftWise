export interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  folder_id: number | null;

  is_pinned: boolean;
  is_favorite: boolean;
  is_archived: boolean;
  deleted_at: string | null;

  created_at: string;
  updated_at: string;
}

export type NewNote = Omit<
  Note,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'is_pinned'
  | 'is_favorite'
  | 'is_archived'
  | 'deleted_at'
>;

export interface Folder {
  id: number;
  name: string;
  created_at: string;
}