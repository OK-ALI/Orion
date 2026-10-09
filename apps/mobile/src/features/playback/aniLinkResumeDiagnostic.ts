/** Opt-in physical URL control; normal builds and explicit zero keep their exact URL. */
export function getAniLinkResumeDiagnosticUrl(sourceId: string, value: string,
  control = process.env.EXPO_PUBLIC_ORION_ANILINK_RESUME_CONTROL): string {
  if (sourceId !== 'anilink' || control !== 'minimal') return value;
  try {
    const url = new URL(value), start = url.searchParams.get('start'), variant = url.searchParams.get('variant');
    if (url.origin !== 'https://anilink.cc' || url.username || url.password || url.hash
      || !/^\/watch\/[1-9]\d{0,8}\/[1-9]\d{0,8}$/.test(url.pathname)
      || !start || !/^[1-9]\d{0,8}$/.test(start) || !['sub', 'dub'].includes(variant || '')) return value;
    for (const [key, entry] of url.searchParams) {
      if (url.searchParams.getAll(key).length !== 1 || !(['variant', 'start'].includes(key)
        || ['autoplay', 'autonext'].includes(key) && ['true', 'false'].includes(entry))) return value;
    }
    return `${url.origin}${url.pathname}?variant=${variant}&start=${start}`;
  } catch { return value; }
}
