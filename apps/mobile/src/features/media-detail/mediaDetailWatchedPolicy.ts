export function canonicalMediaDetailWatchedRecord({
  data,
  immediateRecord,
  type,
  routeId,
  fallbackTitle,
}: {
  data: any;
  immediateRecord?: any;
  type: 'movie' | 'tv';
  routeId: string | number;
  fallbackTitle: string;
}): any | null {
  if (type !== 'movie') return data ? { ...data, media_type: type } : null;
  const id = data?.id ?? immediateRecord?.id ?? routeId;
  if (id == null) return null;
  return {
    ...(immediateRecord || {}),
    ...(data || {}),
    id,
    media_type: 'movie',
    title: data?.title || immediateRecord?.title || fallbackTitle,
  };
}