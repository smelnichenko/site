/** How the masi pages name a language code. */
export const LANGUAGE_NAMES: Record<string, string> = { en: 'English', et: 'Estonian', ru: 'Russian' };

export function languageName(code: string | null): string {
  if (!code) return 'unknown';
  return LANGUAGE_NAMES[code] ?? code;
}

/** What a package's language line says: what it is written in and from which version, and what was asked. */
export function languageLine(writtenIn: string | null, tunedFromVersion: number | null, asked: string | null): string {
  let written = 'not written yet';
  if (writtenIn) {
    const from = tunedFromVersion ? ` from v${tunedFromVersion}` : '';
    written = `written in ${languageName(writtenIn)}${from}`;
  }
  const choice = asked ? `${languageName(asked)} asked` : 'follows the posting';
  return `${written} · ${choice}`;
}
