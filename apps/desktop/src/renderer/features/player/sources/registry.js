/**
 * Legacy Source Registry Bridge
 *
 * The source registry has been migrated to the platform-agnostic
 * @orion/shared package. This file re-exports the registry symbols
 * so existing desktop imports remain unbroken.
 */

export * from "@orion/shared/sources";
