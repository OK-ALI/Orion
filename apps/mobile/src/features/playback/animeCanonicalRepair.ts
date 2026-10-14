import { verifyAnimeIdentity, type AnimeCatalogEvidence, type AnimeIdentityDiagnosticSink, type AnimeIdentityResult, type lookupAnimeEntries } from '@orion/shared/api';
import { exactAnimeRoot, exactAnimeTitle, proveProviderEpisode } from './animeEpisodeProof';
import { readAnimeEpisodeEvidence, type AnimeEntry } from './animePublicEvidence';
export type VerifiedEpisode = Extract<AnimeIdentityResult,{state:'verified'}> & {providerEpisode?:number};
export type CanonicalAnimeIdentity = VerifiedEpisode | {state:'verified';mediaType:'movie';tmdbId:string;anilistId:number};
export type CanonicalAnimeResult = CanonicalAnimeIdentity | {state:'blocked';reason:string};
export type AnimeEvidenceReader = typeof readAnimeEpisodeEvidence;
const emit=(sink:AnimeIdentityDiagnosticSink,event:Parameters<AnimeIdentityDiagnosticSink>[0])=>{try{sink(event);}catch{}};

/** Preserve the qualified strict path; supplement only a failed mapping. */
export async function resolveCanonicalAnimeEpisode(catalog:AnimeCatalogEvidence,detail:any,season:any,entries:AnimeEntry[],lookup:typeof lookupAnimeEntries,signal:AbortSignal,diagnostic:AnimeIdentityDiagnosticSink,evidence:AnimeEvidenceReader=readAnimeEpisodeEvidence):Promise<CanonicalAnimeResult>{
  let decision:Parameters<AnimeIdentityDiagnosticSink>[0]|undefined;
  const trace:AnimeIdentityDiagnosticSink=event=>{if(event.stage==='decision')decision=event;else emit(diagnostic,event);};
  const finish=(result:AnimeIdentityResult)=>{if(decision)emit(diagnostic,decision);return result;};
  const original=verifyAnimeIdentity(catalog,entries,trace);if(original.state==='verified')return finish(original);
  const refreshOptions={catalog,diagnostic,forceRefresh:true};
  const fresh=await lookup(catalog.titles,signal,refreshOptions);
  if(signal.aborted)return {state:'blocked',reason:'lookup-cancelled'};
  const renewed=verifyAnimeIdentity(catalog,fresh,trace);if(renewed.state==='verified')return finish(renewed);
  const roots=fresh.filter(entry=>exactAnimeRoot(catalog,entry));
  if(roots.length!==1)return finish(renewed);
  const requested=season.episodes.find((entry:any)=>entry.episode_number===catalog.episode);
  const proofData=await evidence(roots[0].id,requested.air_date,signal,diagnostic);
  if(signal.aborted)return {state:'blocked',reason:'lookup-cancelled'};
  const proof=proveProviderEpisode(catalog,detail,season,proofData.root,proofData.airings);
  if(proof){
    emit(diagnostic,{stage:'candidate',scope:'season',anilistId:proof.anilistId,episode:proof.providerEpisode,episodeInRange:true,dateMatch:true});
    emit(diagnostic,{stage:'decision',outcome:'accepted',reason:'verified',anilistId:proof.anilistId,episode:proof.providerEpisode,season:catalog.season??0});
    return {state:'verified',tmdbId:catalog.tmdbId,anilistId:proof.anilistId,season:catalog.season,episode:catalog.episode,
      ...(proof.providerEpisode!==catalog.episode?{providerEpisode:proof.providerEpisode}:{})};
  }
  // A refreshed graph may repair stale counts without requiring a new proof.
  const final=verifyAnimeIdentity(catalog,[proofData.root],trace);if(final.state==='verified')return finish(final);
  emit(diagnostic,{stage:'decision',outcome:'rejected',reason:'season-entry-unresolved'});
  return {state:'blocked',reason:'season-entry-unresolved'};
}

/** Films have canonical identity, without invented catalog season/episode fields. */
export async function resolveCanonicalAnimeMovie(id:string,titles:string[],year:number,lookup:typeof lookupAnimeEntries,signal:AbortSignal,diagnostic:AnimeIdentityDiagnosticSink):Promise<CanonicalAnimeResult>{
  if(!Number.isInteger(year)||year<1900||year>2200){emit(diagnostic,{stage:'decision',outcome:'rejected',reason:'invalid-catalog-year'});return {state:'blocked',reason:'invalid-catalog-year'};}
  const match=(entries:AnimeEntry[])=>[...new Map(entries.filter(entry=>Number.isSafeInteger(entry.id)&&entry.id>0&&entry.format==='MOVIE'&&entry.year===year&&exactAnimeTitle(titles,entry.titles)).map(entry=>[entry.id,entry])).values()];
  let candidates=match(await lookup(titles,signal,{diagnostic}));
  if(candidates.length!==1){const refreshOptions={diagnostic,forceRefresh:true};candidates=match(await lookup(titles,signal,refreshOptions));}
  if(signal.aborted)return {state:'blocked',reason:'lookup-cancelled'};
  if(candidates.length!==1){const reason=candidates.length?'ambiguous-candidates':'no-candidates';emit(diagnostic,{stage:'decision',outcome:'rejected',reason});return {state:'blocked',reason};}
  emit(diagnostic,{stage:'decision',outcome:'accepted',reason:'verified',tmdbId:id,mediaType:'movie',anilistId:candidates[0].id});
  return {state:'verified',mediaType:'movie',tmdbId:id,anilistId:candidates[0].id};
}

export function animeFailureCopy(reason:string|undefined,type:'movie'|'tv'):string {
  if(reason==='unsupported-media')return type==='movie'?'This source is not currently available for Anime films in Orion. Choose a General source.':'This source does not support this Anime format. Choose another source.';
  if(reason==='variant-unavailable')return 'This version is not available from this source. Choose another version or source.';
  if(reason?.startsWith('lookup-')||reason==='tmdb-season-lookup-failed')return 'Anime information could not load. Retry or choose another source.';
  if(reason&&['missing-season','missing-episode','missing-episode-list','noncontiguous-episodes','episode-not-released','episode-out-of-range','unsupported-numbering','season-entry-unresolved','candidate-episode-count-mismatch','candidate-season-year-mismatch','sequel-relation-unresolved'].includes(reason))return 'Orion could not match this Anime episode. Choose another source.';
  return 'Orion could not match this Anime reliably. Retry or choose another source.';
}
