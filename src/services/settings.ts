import { Preferences } from '@capacitor/preferences';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type SortSetting = 'updated' | 'created' | 'alphabetical';

const KEYS = {
  theme: 'setting_theme',
  defaultSort: 'setting_default_sort',
  defaultFolderId: 'setting_default_folder_id',
};

export async function getTheme(): Promise<ThemeSetting> {
  const { value } = await Preferences.get({ key: KEYS.theme });
  return (value as ThemeSetting) ?? 'system';
}

export async function setTheme(value: ThemeSetting): Promise<void> {
  await Preferences.set({ key: KEYS.theme, value });
}

export async function getDefaultSort(): Promise<SortSetting> {
  const { value } = await Preferences.get({ key: KEYS.defaultSort });
  return (value as SortSetting) ?? 'updated';
}

export async function setDefaultSort(value: SortSetting): Promise<void> {
  await Preferences.set({ key: KEYS.defaultSort, value });
}

export async function getDefaultFolderId(): Promise<number | null> {
  const { value } = await Preferences.get({ key: KEYS.defaultFolderId });
  return value ? Number(value) : null;
}

export async function setDefaultFolderId(value: number | null): Promise<void> {
  if (value === null) {
    await Preferences.remove({ key: KEYS.defaultFolderId });
  } else {
    await Preferences.set({ key: KEYS.defaultFolderId, value: String(value) });
  }
}

export function applyTheme(theme: ThemeSetting): void {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = theme === 'dark' || (theme === 'system' && prefersDark);

  root.classList.toggle('ion-palette-dark', shouldBeDark);
}