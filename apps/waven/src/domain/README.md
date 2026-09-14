# WAVEN domain layer

This directory contains platform-neutral WAVEN domain entry points and policies only. Provider adapters, Android playback, persistence, React components, and Orion Cloud integration belong outside the domain layer.

The canonical music entity and provider-descriptor contracts are owned by `@orion/shared/music`. WAVEN re-exports that contract surface through `music.ts`; it does not copy Music Planet provider implementations into the mobile app.

Music Planet implementation files remain behavior evidence. P3.1 does not reopen Desktop provider resolution, stream handling, AudioEngine behavior, downloads, or Cinema playback.
