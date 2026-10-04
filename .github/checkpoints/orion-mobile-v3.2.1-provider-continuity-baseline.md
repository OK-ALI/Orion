# Orion Mobile v3.2.1 provider continuity baseline

Recorded: 2026-10-04

- Version: **Orion Mobile v3.2.1 (59)**
- Accepted source checkpoint: `9c28c2d5174cecb1ad25a4af2e84e3dd7aa34398`
- Physical validation status: **ACCEPTED**, confirmed by human validation.
- Package: `com.okali.orion`
- Permanent signer SHA-256: `4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD`
- Baseline branch: `codex/orion-v3.2.1-anime-provider-extension`

## Accepted behavior

- Movie, TV / K-drama, and Anime continuity accepted.
- Existing Orion Resume sheet confirmed across surfaced providers, with
  provider-switch continuity and existing capability restrictions preserved.
- VidSrc.ir playback, Resume, Start Over, settlement, and affinity accepted.
- CineSrc Resume, Replay, and Start Over accepted.
- VidNest continuity path confirmed.
- 111Movie removed from explicit Download Modal -> From Selection; playback
  remains available.
- Episode transitions and the player drawer accepted.
- Orion and Android reduced-motion handling accepted.
- AniEmbed accepted as the first dedicated Anime provider.
- General Auto behavior and the download engine preserved.
- No Trailer work included in this baseline.

Provider presentation copy is finalized:

| Provider | Description |
|---|---|
| VixSrc | Reliable default |
| VidLink | Fast alternative |
| VidNest | Flexible source |
| VidSrc.ir | Slow start, solid |
| CineSrc | Smooth resume |
| 111Movie | Streaming only |

## Next phase

**NEXT PHASE: AniLink qualification**

Once remotely verified, the published branch head containing this note and
the accepted source checkpoint is the trusted Mobile baseline. AniLink work
must branch or continue from that published authority. Do not reopen the
physically accepted provider or continuity system without concrete regression
evidence.

This documentation checkpoint does not amend the accepted source checkpoint.
The unrelated, user-owned `docs/anime-source-candidates.md` and
`docs/cinema-source-candidates.md` remain untracked and outside this baseline.
