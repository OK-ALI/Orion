import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/fraunces/latin-600.css";
import "@fontsource/fraunces/latin-700.css";
import "@fontsource/outfit/latin-500.css";
import "@fontsource/outfit/latin-600.css";
import "@fontsource/outfit/latin-700.css";
import "@fontsource/sora/latin-500.css";
import "@fontsource/sora/latin-600.css";
import "@fontsource/sora/latin-700.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import App from "./app/App";
import { MusicProvider } from "./features/music/context/MusicProvider";
import StartupIntro from "./app/startup/StartupIntro";
import { applyStoredAppearance } from "./app/startup/applyStartupAppearance";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/components.css";

const startupAppearance = applyStoredAppearance();

function OrionRoot() {
  const [showStartup, setShowStartup] = useState(true);
  const finishStartup = useCallback(() => setShowStartup(false), []);

  return (
    <MusicProvider>
      <App />
      {showStartup && (
        <StartupIntro
          reducedMotion={startupAppearance.reducedMotion}
          onComplete={finishStartup}
        />
      )}
    </MusicProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><OrionRoot /></React.StrictMode>,
);
