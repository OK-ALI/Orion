# WAVEN domain layer

This directory will contain platform-neutral music entities and policies only. Provider adapters, Android playback, persistence, and React components belong outside the domain layer.

Music Planet models must be extracted here or into a dedicated shared package only after behavior-preserving contract tests exist. Desktop implementation files are evidence, not mobile-ready imports.
