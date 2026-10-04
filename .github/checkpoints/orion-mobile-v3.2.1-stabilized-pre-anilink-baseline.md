# Orion Mobile v3.2.1 stabilized baseline before AniLink

Recorded: 2026-10-04

- Physically accepted implementation: `e20cb3e76065454cbd84d6772f86ea56a5d55569`
- Implementation parent: `1000fd8300515cafa38ddc47a2bfff986f91ddd4`
- Physical validation: **ACCEPTED**, confirmed by human qualification.
- Package/version: `com.okali.orion`, **3.2.1 (59)**
- Permanent signer SHA-256: `4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD`
- Baseline branch: `codex/orion-v3.2.1-anime-provider-extension`

## Accepted product boundaries

- Movie, TV / K-drama and Anime playback; the existing Resume sheet,
  Resume, Start from Beginning, Replay last 30 seconds and manual source
  switching. Movie and series affinity, Anime provider/variant affinity,
  episode-specific progress and later-season continuity are accepted.
- VixSrc, VidLink, VidNest, VidSrc.ir, CineSrc and 111Movie playback remain
  available, with existing VidSrc restrictions and General Auto preserved.
- VidSrc.ir playback, continuity, settlement, affinity and provisional
  warnings; CineSrc Resume, Replay, Start Over and one-shot command ownership;
  VidNest continuity are accepted.
- Downloads remain sealed. 111Movie is excluded from explicit Download
  Modal -> From Selection; the qualified download architecture is preserved.
- Provider copy, compact edge drawer, grip-only opening and episode
  transitions are accepted.
- Orion and Android reduced-motion parity, Connect, Person/Cast, Settings
  and native Offline Player polish are accepted.
- The existing trailer player is preserved. Candidate fallback,
  original-language TMDb alternatives, bounded traversal and external
  Search YouTube continuation are physically accepted; known-good trailers
  retain their existing behavior.
- AniEmbed remains the first physically qualified dedicated Anime provider.
  General providers remain available for Anime.

These boundaries are sealed unless concrete regression evidence warrants a
narrow repair. This note records the accepted implementation without amending
it or rewriting the previous checkpoint note.

## Next phase

**NEXT PHASE: AniLink qualification**

After remote verification, this milestone commit is the trusted GitHub
authority for AniLink work. AniLink implementation and qualification remain
local until human physical acceptance; Auto and downloads remain disabled
for the new provider during qualification.

The unrelated user-owned `docs/cinema-source-candidates.md` and
`docs/anime-source-candidates.md` remain untracked and outside Git.
