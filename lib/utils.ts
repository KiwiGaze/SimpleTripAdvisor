// /lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Globe, Mountain } from 'lucide-react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 15)}`;
}

export function getUserId(): string {
  if (typeof window === 'undefined') return '';

  let userId = localStorage.getItem('mem0_user_id');
  if (!userId) {
    userId = generateId('user');
    localStorage.setItem('mem0_user_id', userId);
  }
  return userId;
}

export type SearchGroupId = 'web';

export const searchGroups = [
  {
    id: 'web' as const,
    name: 'Web',
    description: 'Plan your trip using web search',
    icon: Globe,
    show: true,
  }
] as const;

export type SearchGroup = typeof searchGroups[number];
