import { useCallback, useEffect, useState } from "react";
import { secureStorage } from "../../services/settingsStore";
import {
  BUNDLED_TMDB_TOKEN,
  getTmdbTokenSource,
  setApiErrorHandlers,
} from "../../services/tmdb";

export function useApiSession() {
  const [apiKey, setApiKey] = useState(null);
  const [apiKeySource, setApiKeySource] = useState("missing");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState("checking");
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    let mounted = true;
    secureStorage.get("apikey").then((value) => {
      if (!mounted) return;
      const userToken = value || "";
      setApiKey(userToken || BUNDLED_TMDB_TOKEN || null);
      setApiKeySource(getTmdbTokenSource(userToken));
      setApiKeyLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setApiErrorHandlers(
      () => setApiKeyStatus("invalid_token"),
      () => setApiKeyStatus("unreachable"),
    );
  }, []);

  useEffect(() => {
    // The existing connection owner validates this token, with a deadline and fencing.
    setApiKeyStatus(apiKey ? "checking" : "ok");
  }, [apiKey]);

  const saveApiKey = useCallback((key) => {
    secureStorage.set("apikey", key);
    setApiKey(key);
    setApiKeySource("user");
  }, []);

  const changeApiKey = useCallback(() => {
    secureStorage.set("apikey", "");
    setApiKey(null);
    setApiKeySource("missing");
    setApiKeyLoaded(true);
    setSkipped(false);
  }, []);

  const skipApiKey = useCallback(() => {
    setApiKey(BUNDLED_TMDB_TOKEN || null);
    setApiKeySource(getTmdbTokenSource(""));
    setSkipped(true);
  }, []);

  return {
    apiKey,
    apiKeyLoaded,
    apiKeySource,
    apiKeyStatus,
    changeApiKey,
    saveApiKey,
    setApiKeyStatus,
    skipApiKey,
    skipped,
  };
}
