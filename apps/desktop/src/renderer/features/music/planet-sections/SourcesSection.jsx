import { useMemo } from "react";
import MusicOrbitalStage from "../components/MusicOrbitalStage";
import { useMusic } from "../context/MusicProvider";
import { buildSignalSources } from "../services/signalSources";

export default function SourcesSection({ onNavigate }) {
  const { providers: providersStore } = useMusic();
  const sources = useMemo(() => buildSignalSources(providersStore?.providers || []), [providersStore?.providers]);
  return <MusicOrbitalStage id="sources" sceneState="queue-satellites" anchor="right" eyebrow="Explore"
    title="Signal Sources" description="A clear view of the services powering catalog, playback and lyrics."
    action={<button onClick={() => onNavigate?.("music-sources")}>Open source health</button>} state="ready">
    <div className="music-stage-source-list">
      {sources.map((source) => <article key={source.id} className={`music-stage-source status-${source.setupState}`}>
        <span className="music-signal-orb" aria-hidden="true"><i /></span>
        <div><small>{source.roleLabel}</small><strong>{source.label}</strong><p>{source.description}</p></div>
        <b>{source.setupState}</b>
      </article>)}
    </div>
  </MusicOrbitalStage>;
}
