import type { ReactNode } from 'react';
import type { AppSettings } from '../../lib/appSettings';

export type Choice<T> = readonly (readonly [T, string])[];

type Base = { label: string; hint?: string; mark?: string; visible?: () => boolean; disabledWhen?: (settings: AppSettings) => boolean };

export type SettingOption =
  | (Base & { kind: 'toggle'; key: keyof AppSettings })
  | (Base & { kind: 'select'; key: keyof AppSettings; options: Choice<string | number> })
  | (Base & { kind: 'segmented'; key: keyof AppSettings; options: Choice<string> })
  | (Base & { kind: 'number'; key: keyof AppSettings; min: number; max: number; step?: number; suffix?: string })
  | (Base & { kind: 'text'; key: keyof AppSettings; placeholder?: string; maxLength?: number })
  | (Base & { kind: 'custom'; id: string; render: () => ReactNode; keywords?: string });

export type SettingGroup = 'general' | 'doc' | 'sheet' | 'slide';
export type SettingSection = { id: string; title: string; description: string; icon: ReactNode; options: SettingOption[] };
export type SettingCategory = { id: string; title: string; description: string; icon: ReactNode; group: SettingGroup; sections: SettingSection[] };

export const GROUP_TITLES: Record<SettingGroup, string> = { general: 'Chung', doc: 'Minh Docs', sheet: 'Minh Sheets', slide: 'Minh Slides' };
