import { normalizeAnimeTitle, type AnimeCatalogEvidence } from '@orion/shared/api';
import type { AnimeEntry, AiredAnimeEpisode } from './animePublicEvidence';
export interface ProviderEpisodeProof {anilistId:number;providerEpisode:number;proof:'aired-episode'|'whole-series-count'|'linked-cour-boundaries'}
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const formats=['TV','TV_SHORT','ONA','OVA','SPECIAL'];
const sameDate=(a?:string,b?:string)=>!!a&&!!b&&Number.isFinite(Date.parse(a))&&Number.isFinite(Date.parse(b))&&Math.abs(Date.parse(a)-Date.parse(b))<=86_400_000;
export const exactAnimeTitle=(a:string[],b:string[])=>{const left=new Set(a.map(normalizeAnimeTitle));return b.some(title=>left.has(normalizeAnimeTitle(title)));};
export const exactAnimeRoot=(catalog:AnimeCatalogEvidence,entry:AnimeEntry)=>exactAnimeTitle(catalog.titles,entry.titles)&&catalog.year===entry.year&&formats.includes(entry.format);
function descendants(root:AnimeEntry):AnimeEntry[]{const result:AnimeEntry[]=[];const seen=new Set<number>();const visit=(node:AnimeEntry,depth:number)=>{if(depth>8||seen.has(node.id)||result.length>=25)return;seen.add(node.id);result.push(node);node.sequels.forEach(child=>visit(child,depth+1));};visit(root,0);return result;}
const unique=(proofs:ProviderEpisodeProof[])=>{const values=[...new Map(proofs.map(p=>[`${p.anilistId}:${p.providerEpisode}`,p])).values()];return values.length===1?values[0]:null;};

/** Separate logical TMDb coordinates from independently proved provider numbering. */
export function proveProviderEpisode(catalog:AnimeCatalogEvidence,detail:any,season:any,root:AnimeEntry,airings:AiredAnimeEpisode[],now=Date.now()):ProviderEpisodeProof|null {
  if(!exactAnimeRoot(catalog,root)||!sameDate(detail.first_air_date,root.releaseDate))return null;
  const episodes=season.episodes;const requested=episodes?.find((e:any)=>e.episode_number===catalog.episode);const requestedDate=requested?.air_date;
  if(!Array.isArray(episodes)||!Number.isFinite(Date.parse(requestedDate))||Date.parse(requestedDate)>now)return null;
  const nodes=descendants(root);const byId=new Map(nodes.map(node=>[node.id,node]));
  const eligible=airings.filter(a=>{const node=byId.get(a.mediaId);return !!node&&formats.includes(node.format)&&positive(a.episode)&&a.airingAt*1000<=now
    &&(!positive(node.episodes)||a.episode<=node.episodes)&&sameDate(requestedDate,new Date(a.airingAt*1000).toISOString().slice(0,10));});
  const exact=eligible.filter(a=>new Date(a.airingAt*1000).toISOString().slice(0,10)===requestedDate);
  const dated=exact.length?exact:eligible;
  if(dated.length)return unique(dated.map(a=>({anilistId:a.mediaId,providerEpisode:a.episode,proof:'aired-episode'})));

  // A single AniList series can span several TMDb seasons. Use complete catalog
  // counts and chronology, never a guessed offset or the TMDb season index.
  const regular=(Array.isArray(detail.seasons)?detail.seasons:[]).filter((s:any)=>s.season_number>0).sort((a:any,b:any)=>a.season_number-b.season_number);
  const contiguous=regular.length>0&&regular.every((s:any,index:number)=>s.season_number===index+1&&positive(s.episode_count)&&Number.isFinite(Date.parse(s.air_date))
    &&(index===0||Date.parse(s.air_date)>Date.parse(regular[index-1].air_date)));
  const total=regular.reduce((sum:number,s:any)=>sum+s.episode_count,0);const selected=regular.find((s:any)=>s.season_number===catalog.season);
  if(contiguous&&positive(root.episodes)&&root.episodes===total&&detail.number_of_episodes===total&&selected?.episode_count===episodes.length
    &&sameDate(regular[0].air_date,root.releaseDate)&&sameDate(selected.air_date,season.air_date)){
    const next=regular.find((s:any)=>s.season_number===(catalog.season||0)+1);
    if(Date.parse(requestedDate)>=Date.parse(selected.air_date)&&(!next||Date.parse(requestedDate)<Date.parse(next.air_date))){
      const previous=regular.filter((s:any)=>s.season_number<(catalog.season||0)).reduce((sum:number,s:any)=>sum+s.episode_count,0);
      const episode=previous+catalog.episode;if(episode<=root.episodes)return {anilistId:root.id,providerEpisode:episode,proof:'whole-series-count'};
    }
  }

  // A TMDb season can contain multiple independently released AniList cours.
  // Every boundary must match a canonical episode date, the full count must
  // close, and every next entry must be an explicit SEQUEL relation.
  if(!episodes.every((e:any,index:number)=>e.episode_number===index+1&&Number.isFinite(Date.parse(e.air_date))
    &&(index===0||Date.parse(e.air_date)>=Date.parse(episodes[index-1].air_date))))return null;
  const answers:ProviderEpisodeProof[]=[];
  const visit=(node:AnimeEntry,offset:number,selectedProof:ProviderEpisodeProof|null,seen:Set<number>)=>{
    if(seen.size>=8||seen.has(node.id)||!formats.includes(node.format)||!positive(node.episodes)||offset+node.episodes>episodes.length
      ||!sameDate(episodes[offset]?.air_date,node.releaseDate))return;
    const proof=catalog.episode>offset&&catalog.episode<=offset+node.episodes?{anilistId:node.id,providerEpisode:catalog.episode-offset,proof:'linked-cour-boundaries' as const}:selectedProof;
    const end=offset+node.episodes;if(end===episodes.length){if(proof)answers.push(proof);return;}
    const nextSeen=new Set(seen);nextSeen.add(node.id);
    node.sequels.filter(child=>Date.parse(child.releaseDate||'')>Date.parse(node.releaseDate||'')).forEach(child=>visit(child,end,proof,nextSeen));
  };
  nodes.filter(node=>node.year===catalog.seasonYear&&sameDate(season.air_date,node.releaseDate)).forEach(node=>visit(node,0,null,new Set()));
  return unique(answers);
}
