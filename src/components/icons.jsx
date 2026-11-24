import { GraduationCap, Sparkles, Users, Home, Dumbbell, Flower2, Wallet, Briefcase, FolderKanban, Languages, Moon, BookOpen, Tag } from 'lucide-react';

export const SPACE_ICONS = {
  etudes: GraduationCap, glowup: Sparkles, social: Users, perso: Home, sport: Dumbbell, beaute: Flower2,
  finances: Wallet, projets: FolderKanban, carriere: Briefcase, langues: Languages, habitudes: Moon, lecture: BookOpen,
  default: Tag,
};

// Discreet line illustration: books, a candle and a cup of coffee.
export function LibraryArt({ size = 150 }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 240 150" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 146h224" />
      <rect x="22" y="58" width="18" height="88" rx="2" /><path d="M26 70h10M26 134h10" />
      <rect x="42" y="44" width="22" height="102" rx="2" /><path d="M47 58h12M47 132h12" />
      <rect x="66" y="66" width="16" height="80" rx="2" />
      <path d="M86 146l14-82 18 3-14 79" /><path d="M98 80l14 2" />
      <path d="M150 146v-46h16v46" /><path d="M158 100c-5-6-3-12 0-18 3 6 5 12 0 18z" fill="currentColor" fillOpacity=".18" />
      <path d="M158 82v-6" />
      <path d="M186 118h30v18a10 10 0 0 1-10 10h-10a10 10 0 0 1-10-10z" /><path d="M216 124h5a6 6 0 0 1 0 12h-5" />
      <path d="M195 110c-3-4 3-6 0-10M205 110c-3-4 3-6 0-10" />
      <path d="M124 146c0-14 6-24 14-30M132 128c-6-2-10 0-12 4M134 120c4-6 10-6 12-4" />
    </svg>
  );
}
