# Orion Cloud Android adapter

This directory is the shared Android source owner for Orion Cloud Google identity and
private Drive app-data transport.

Phase 2.1 is a structural extraction only. The existing Kotlin package names, React
Native module names, OAuth scope, Gradle dependency versions, Drive file identity,
concurrency behavior, and native-only token boundary remain unchanged.

Orion Mobile keeps its existing app.json plugin entry points through compatibility
wrappers in apps/mobile/plugins. Its standalone Android builder also reads the native
sources from this directory.

WAVEN is deliberately not wired to this adapter during Phase 2.1. Google sign-in, Drive
access, and live Orion Cloud mutation remain forbidden until later Phase 2 gates.
