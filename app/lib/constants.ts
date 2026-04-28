import { Language } from "@heygen/liveavatar-web-sdk";

export type AvatarOption = {
  avatar_id: string;
  name: string;
};

// Fallback public avatar if the configured custom avatar fails to start.
// Keep a single well-known entry; LiveAvatar avatar IDs are UUIDs.
export const AVATARS: AvatarOption[] = [
  {
    avatar_id:
      process.env.NEXT_PUBLIC_LIVEAVATAR_AVATAR_ID ??
      "e03ebc18-0ff9-4a4c-87e1-0df30aba5e70",
    name: "Sparkasse Berater",
  },
];

export type LanguageOption = {
  label: string;
  value: Language;
  key: string;
};

export const STT_LANGUAGE_LIST: LanguageOption[] = [
  { label: "Bulgarian", value: Language.bg, key: "bg" },
  { label: "Chinese", value: Language.zh, key: "zh" },
  { label: "Czech", value: Language.cs, key: "cs" },
  { label: "Danish", value: Language.da, key: "da" },
  { label: "Dutch", value: Language.nl, key: "nl" },
  { label: "English", value: Language.en, key: "en" },
  { label: "Finnish", value: Language.fi, key: "fi" },
  { label: "French", value: Language.fr, key: "fr" },
  { label: "German", value: Language.de, key: "de" },
  { label: "Greek", value: Language.el, key: "el" },
  { label: "Hindi", value: Language.hi, key: "hi" },
  { label: "Hungarian", value: Language.hu, key: "hu" },
  { label: "Indonesian", value: Language.id, key: "id" },
  { label: "Italian", value: Language.it, key: "it" },
  { label: "Japanese", value: Language.ja, key: "ja" },
  { label: "Korean", value: Language.ko, key: "ko" },
  { label: "Malay", value: Language.ms, key: "ms" },
  { label: "Norwegian", value: Language.no, key: "no" },
  { label: "Polish", value: Language.pl, key: "pl" },
  { label: "Portuguese", value: Language.pt, key: "pt" },
  { label: "Romanian", value: Language.ro, key: "ro" },
  { label: "Russian", value: Language.ru, key: "ru" },
  { label: "Slovak", value: Language.sk, key: "sk" },
  { label: "Spanish", value: Language.es, key: "es" },
  { label: "Swedish", value: Language.sv, key: "sv" },
  { label: "Turkish", value: Language.tr, key: "tr" },
  { label: "Ukrainian", value: Language.uk, key: "uk" },
  { label: "Vietnamese", value: Language.vi, key: "vi" },
];
