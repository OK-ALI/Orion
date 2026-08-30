"use strict";

const fs = require("node:fs");
const { parseProjectEnv } = require("@expo/env");

const GOOGLE_WEB_CLIENT_ID_ENV = "EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID";
const TMDB_READ_TOKEN_ENV = "EXPO_PUBLIC_TMDB_READ_TOKEN";
const GOOGLE_WEB_CLIENT_ID_PATTERN = /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/;
const TMDB_READ_TOKEN_PATTERN = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const REQUIRED_MOBILE_BUNDLED_ENV = Object.freeze([
  GOOGLE_WEB_CLIENT_ID_ENV,
  TMDB_READ_TOKEN_ENV,
]);

function resolveProductionEnv(projectDirectory, systemEnv) {
  return parseProjectEnv(projectDirectory, {
    mode: "production",
    silent: true,
    systemEnv,
  }).env;
}

function resolveGoogleWebClientId(projectDirectory, systemEnv = process.env) {
  const parsed = resolveProductionEnv(projectDirectory, systemEnv);
  const raw = systemEnv[GOOGLE_WEB_CLIENT_ID_ENV] ?? parsed[GOOGLE_WEB_CLIENT_ID_ENV] ?? "";
  return String(raw).trim();
}

function resolveTmdbReadToken(projectDirectory, systemEnv = process.env) {
  const parsed = resolveProductionEnv(projectDirectory, systemEnv);
  const raw = systemEnv[TMDB_READ_TOKEN_ENV] ?? parsed[TMDB_READ_TOKEN_ENV] ?? "";
  return String(raw).trim();
}

function requireGoogleProductionConfig(projectDirectory, systemEnv = process.env) {
  const clientId = resolveGoogleWebClientId(projectDirectory, systemEnv);
  if (!GOOGLE_WEB_CLIENT_ID_PATTERN.test(clientId)) {
    throw new Error(
      `${GOOGLE_WEB_CLIENT_ID_ENV} must contain a valid Google Web OAuth client ID before Orion creates a production Android bundle.`,
    );
  }
  systemEnv[GOOGLE_WEB_CLIENT_ID_ENV] = clientId;
  return clientId;
}

function requireMobileProductionConfig(projectDirectory, systemEnv = process.env) {
  const googleWebClientId = resolveGoogleWebClientId(projectDirectory, systemEnv);
  if (!GOOGLE_WEB_CLIENT_ID_PATTERN.test(googleWebClientId)) {
    throw new Error(
      `${GOOGLE_WEB_CLIENT_ID_ENV} must contain a valid Google Web OAuth client ID before Orion creates a production Android bundle.`,
    );
  }
  const tmdbReadToken = resolveTmdbReadToken(projectDirectory, systemEnv);
  if (!TMDB_READ_TOKEN_PATTERN.test(tmdbReadToken)) {
    throw new Error(
      `${TMDB_READ_TOKEN_ENV} must contain a valid TMDB API read token before Orion creates a production Android bundle.`,
    );
  }
  systemEnv[GOOGLE_WEB_CLIENT_ID_ENV] = googleWebClientId;
  systemEnv[TMDB_READ_TOKEN_ENV] = tmdbReadToken;
  return Object.freeze({ googleWebClientId, tmdbReadToken });
}

function verifyGoogleClientIdEmbedded(bundlePath, clientId) {
  if (!GOOGLE_WEB_CLIENT_ID_PATTERN.test(clientId)) {
    throw new Error("Google production configuration cannot be verified because the client ID is invalid.");
  }
  if (!fs.existsSync(bundlePath)) {
    throw new Error("Google production configuration cannot be verified because the Android bundle is missing.");
  }
  const bundle = fs.readFileSync(bundlePath);
  if (!bundle.includes(Buffer.from(clientId, "utf8"))) {
    throw new Error("The production Android bundle does not contain Orion's configured Google sign-in authority.");
  }
}

function verifyMobileProductionConfigEmbedded(bundlePath, config) {
  if (
    !config
    || !GOOGLE_WEB_CLIENT_ID_PATTERN.test(config.googleWebClientId)
    || !TMDB_READ_TOKEN_PATTERN.test(config.tmdbReadToken)
  ) {
    throw new Error("Mobile production configuration cannot be verified because a required value is invalid.");
  }
  if (!fs.existsSync(bundlePath)) {
    throw new Error("Mobile production configuration cannot be verified because the Android bundle is missing.");
  }
  const bundle = fs.readFileSync(bundlePath);
  for (const value of [config.googleWebClientId, config.tmdbReadToken]) {
    if (!bundle.includes(Buffer.from(value, "utf8"))) {
      throw new Error("The production Android bundle is missing a required Orion public runtime configuration value.");
    }
  }
}

module.exports = {
  GOOGLE_WEB_CLIENT_ID_ENV,
  GOOGLE_WEB_CLIENT_ID_PATTERN,
  REQUIRED_MOBILE_BUNDLED_ENV,
  TMDB_READ_TOKEN_ENV,
  TMDB_READ_TOKEN_PATTERN,
  requireMobileProductionConfig,
  requireGoogleProductionConfig,
  resolveGoogleWebClientId,
  resolveTmdbReadToken,
  verifyMobileProductionConfigEmbedded,
  verifyGoogleClientIdEmbedded,
};
