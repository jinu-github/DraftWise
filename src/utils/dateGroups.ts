import { Note } from '../types/Note';

export function groupNotesByDate(notes: Note[]): { label: string; notes: Note[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(startOfToday);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const buckets: Record<string, Note[]> = {};
  const order: string[] = [];

  const pushTo = (label: string, note: Note) => {
    if (!buckets[label]) {
      buckets[label] = [];
      order.push(label);
    }
    buckets[label].push(note);
  };

  notes.forEach((note) => {
    const noteDate = new Date(note.updated_at);
    if (noteDate >= startOfToday) {
      pushTo('Today', note);
    } else if (noteDate >= sevenDaysAgo) {
      pushTo('Previous 7 Days', note);
    } else if (noteDate >= thirtyDaysAgo) {
      pushTo('Previous 30 Days', note);
    } else {
      const monthLabel = noteDate.toLocaleString(undefined, {
        month: 'long',
        year: noteDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
      pushTo(monthLabel, note);
    }
  });

  return order.map((label) => ({ label, notes: buckets[label] }));
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `Edited ${mins}m ago`;
  if (hours < 24) return `Edited ${hours}h ago`;
  if (days < 7) return `Edited ${days}d ago`;
  return `Edited ${new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}