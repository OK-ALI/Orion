export type TitleCastPerson = {
  id: number;
  name: string;
  profile_path: string | null;
  character: string;
  order: number;
  credit_id?: string;
  known_for_department?: string;
};
export type TitleCrewPerson = TitleCastPerson & { job: string };

const KEY_CREW_ORDER = ['Director', 'Creator', 'Screenplay', 'Writer', 'Executive Producer', 'Producer'] as const;

export function normalizeTitleCast(raw: unknown): TitleCastPerson[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw
    .map((person, index) => ({ ...person, order: Number.isFinite(person?.order) ? person.order : 999, index }))
    .filter((person) => Number.isInteger(person?.id) && person.id > 0 && String(person?.name || '').trim())
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .filter((person) => {
      const key = person.credit_id || `${person.id}:${person.character || ''}:${person.order}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ index, ...person }) => ({
      ...person,
      profile_path: person.profile_path || null,
      character: String(person.character || '').trim(),
    }));
}

export function extractTitleKeyCrew(crew: unknown, creators: unknown, limit = 12): TitleCrewPerson[] {
  const rawCrew = Array.isArray(crew) ? crew : [];
  const rawCreators = Array.isArray(creators) ? creators : [];
  const entries = [
    ...rawCreators.map((person) => ({ ...person, job: 'Creator' })),
    ...rawCrew.filter((person) => KEY_CREW_ORDER.includes(person?.job)).map((person) => ({ ...person })),
  ];
  const seen = new Set<string>();
  return entries
    .filter((person) => Number.isInteger(person?.id) && person.id > 0 && String(person?.name || '').trim())
    .sort((a, b) => KEY_CREW_ORDER.indexOf(a.job) - KEY_CREW_ORDER.indexOf(b.job))
    .filter((person) => {
      const key = `${person.id}_${person.job}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((person) => ({ ...person, profile_path: person.profile_path || null, character: '', order: 999 }));
}
