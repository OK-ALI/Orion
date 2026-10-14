import { AnimeLookupError, type lookupAnimeEntries, type AnimeIdentityDiagnosticSink } from '@orion/shared/api';

export type AnimeEntry = Awaited<ReturnType<typeof lookupAnimeEntries>>[number];
export type FreshAnimeEntry = AnimeEntry & { status: string; endDate?: string };
export interface AiredAnimeEpisode { mediaId: number; episode: number; airingAt: number }
const ENDPOINT = 'https://graphql.anilist.co';
const FIELDS = 'id type format status title {english romaji native} synonyms episodes startDate {year month day} endDate {year month day} relations {edges {relationType node {id type}}}';
const MEDIA = `query($ids:[Int]){Page(page:1,perPage:10){pageInfo{hasNextPage}media(id_in:$ids,type:ANIME){${FIELDS}}}}`;
const AIRING = 'query($ids:[Int],$after:Int,$before:Int){Page(page:1,perPage:50){pageInfo{hasNextPage}airingSchedules(mediaId_in:$ids,airingAt_greater:$after,airingAt_lesser:$before){mediaId episode airingAt}}}';
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
function date(value: any): string | undefined {
  if (![value?.year, value?.month, value?.day].every(positive)) return undefined;
  const text = `${value.year}-${String(value.month).padStart(2,'0')}-${String(value.day).padStart(2,'0')}`;
  return Number.isFinite(Date.parse(text)) ? text : undefined;
}
function entry(value: any): FreshAnimeEntry {
  if (value?.type !== 'ANIME' || !positive(value.id) || !Array.isArray(value.relations?.edges)) throw new AnimeLookupError('lookup-malformed-response');
  const titles = [...Object.values(value.title || {}), ...(Array.isArray(value.synonyms) ? value.synonyms : [])].filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 300);
  if (value.episodes !== null && (!Number.isSafeInteger(value.episodes) || value.episodes < 0)) throw new AnimeLookupError('lookup-malformed-response');
  return { id:value.id, titles:[...new Set(titles)], format:String(value.format || ''), status:String(value.status || ''), year:Number(value.startDate?.year) || 0,
    episodes:value.episodes ?? 0, releaseDate:date(value.startDate), endDate:date(value.endDate), sequels:[],
    sequelIds:[...new Set<number>(value.relations.edges.filter((e:any)=>e.relationType==='SEQUEL'&&e.node?.type==='ANIME'&&positive(e.node.id)).map((e:any)=>e.node.id))] };
}

/** Fresh public metadata only; no provider credentials, user state or stream work. */
export async function readAnimeEpisodeEvidence(rootId:number, airDate:string, signal:AbortSignal, diagnostic?:AnimeIdentityDiagnosticSink):Promise<{root:FreshAnimeEntry;airings:AiredAnimeEpisode[]}> {
  const controller = new AbortController(); const abort = () => controller.abort();
  signal.addEventListener('abort',abort,{once:true}); if(signal.aborted) abort();
  let timedOut=false; const timer=setTimeout(()=>{timedOut=true;abort();},10_000);
  const cancelled=()=>{if(controller.signal.aborted)throw new AnimeLookupError(timedOut?'lookup-timeout':'lookup-cancelled');};
  const read=async(query:string,variables:object,limit:number):Promise<any>=>{
    cancelled(); let response:Response;
    try { response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query,variables}),signal:controller.signal}); }
    catch {cancelled();throw new AnimeLookupError('lookup-network-failed');}
    if(!response.ok)throw new AnimeLookupError('lookup-http-rejected');
    let raw:string;try{raw=await response.text();}catch{cancelled();throw new AnimeLookupError('lookup-network-failed');}
    cancelled();if(raw.length>250_000)throw new AnimeLookupError('lookup-response-too-large');
    let body:any;try{body=JSON.parse(raw);}catch{throw new AnimeLookupError('lookup-malformed-response');}
    if(body?.errors)throw new AnimeLookupError('lookup-graphql-failed');
    const page=body?.data?.Page;if(!page||page.pageInfo?.hasNextPage!==false)throw new AnimeLookupError('lookup-relation-incomplete');
    const values=page.media||page.airingSchedules;if(!Array.isArray(values)||values.length>limit)throw new AnimeLookupError('lookup-malformed-response');
    try{diagnostic?.({stage:'lookup',scope:'relation',responseCharacters:raw.length,candidates:values.length});}catch{}
    return values;
  };
  try {
    const nodes=new Map<number,FreshAnimeEntry>();let pending=[rootId],depth=0;
    while(pending.length){
      const ids=[...new Set(pending)].filter(id=>!nodes.has(id));if(!ids.length)break;
      if(++depth>8||nodes.size+ids.length>25)throw new AnimeLookupError('lookup-relation-limit');pending=[];
      for(let offset=0;offset<ids.length;offset+=10){
        const batch=ids.slice(offset,offset+10);const values=(await read(MEDIA,{ids:batch},10)).map(entry);
        if(values.length!==batch.length||values.some((v:FreshAnimeEntry)=>!batch.includes(v.id))||new Set(values.map((v:FreshAnimeEntry)=>v.id)).size!==batch.length)throw new AnimeLookupError('lookup-relation-incomplete');
        values.forEach((v:FreshAnimeEntry)=>{nodes.set(v.id,v);pending.push(...(v.sequelIds||[]));});
      }
    }
    const root=nodes.get(rootId);if(!root)throw new AnimeLookupError('lookup-relation-incomplete');
    for(const node of nodes.values())node.sequels=(node.sequelIds||[]).map(id=>nodes.get(id)!);
    const time=Date.parse(airDate)/1000;if(!Number.isFinite(time))throw new AnimeLookupError('unsupported-numbering');
    const airings:AiredAnimeEpisode[]=[];
    const ids=[...nodes.keys()];
    for(let offset=0;offset<ids.length;offset+=10){
      const batch=ids.slice(offset,offset+10);const values=await read(AIRING,{ids:batch,after:time-86_401,before:time+172_800},50);
      for(const v of values){if(!batch.includes(v.mediaId)||!positive(v.episode)||!Number.isSafeInteger(v.airingAt))throw new AnimeLookupError('lookup-malformed-response');airings.push({mediaId:v.mediaId,episode:v.episode,airingAt:v.airingAt});}
    }
    cancelled();return {root,airings};
  } finally {clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
