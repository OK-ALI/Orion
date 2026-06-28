import { useState } from "react";
import { storage, STORAGE_KEYS, isElectron, formatBytes } from "../../../services/settingsStore";
import { DEFAULT_INVIDIOUS_BASE } from "../../../components/TrailerModal";
import { RATING_COUNTRIES } from "../../../shared/utils/ageRating";
import { AGE_LIMIT_OPTIONS } from "../settingsConstants";
import { CleanRow, SettingsSelect, Toggle } from "../components/SettingsControls";
import { VersionSection, HomeLayoutSection, BackupRestoreSection } from "../sections/GeneralSettings";
import { AppearanceSection } from "../sections/InterfaceSettings";
import { LibraryPrivacySection, StartPageSection, CloseBehaviorSection, TmdbLanguageSection } from "../sections/LibrarySettings";
import { SubtitleSettingsSection, NotificationsSection } from "../sections/SubtitleSettings";
import { SectionGroupHeader, Divider, SystemCheckSection, DownloaderToolsSection } from "../sections/SystemSettings";
export default function PlaybackSettingsGroup({
  model
}) {
  const [miniBehavior, setMiniBehavior] = useState(
    () => storage.get(STORAGE_KEYS.MINI_PLAYER_BEHAVIOR) || "auto",
  );
  const {
    autoplayNextDuration,
    autoplayNextEnabled,
    autoplayNextLayout,
    checkInvidious,
    flash,
    handleSaveThreshold,
    introSkipMode,
    saved,
    invidiousBase,
    invidiousChecking,
    invidiousSaved,
    invidiousStatus,
    saveInvidiousBase,
    secPlayback,
    setAutoplayNextDuration,
    setAutoplayNextEnabled,
    setAutoplayNextLayout,
    setIntroSkipMode,
    setInvidiousBase,
    setInvidiousStatus,
    setWatchedThreshold,
    watchedThreshold
  } = model;
  return <div ref={secPlayback} style={{
    scrollMarginTop: 80
  }}>
          <SectionGroupHeader title="Playback" subtitle="Trailer source and auto-watched behavior" />

          <div style={{ marginBottom: 32 }}>
            <div className="settings-section-title">Playback continuity</div>
            <CleanRow
              title="When navigating away"
              description="Choose whether active playback moves into Orion's mini-player. Pop-out playback always returns to mini-player when closed."
              right={
                <SettingsSelect value={miniBehavior} onChange={(value) => {
                  setMiniBehavior(value);
                  storage.set(STORAGE_KEYS.MINI_PLAYER_BEHAVIOR, value);
                  flash();
                }} options={[
                  { value: "auto", label: "Auto" },
                  { value: "ask", label: "Ask" },
                  { value: "manual", label: "Manual" },
                ]} />
              }
            />
          </div>

          <Divider />

          {/* Invidious */}
          <div style={{
      marginBottom: 40
    }}>
            <div className="settings-section-title">Invidious Instance</div>
            <div style={{
        fontSize: 13,
        color: "var(--text3)",
        marginBottom: 16,
        lineHeight: 1.6
      }}>
              Trailers are played via{" "}
              <span style={{
          color: "var(--text)",
          fontWeight: 600
        }}>
                Invidious
              </span>
              , a privacy-friendly YouTube frontend. Your configured instance is
              tried first; if it fails, the app automatically falls back through
              a list of known working instances. The default is{" "}
              <code style={{
          fontSize: 12
        }}>{DEFAULT_INVIDIOUS_BASE}</code>.
              The instance must have its API enabled (
              <code style={{
          fontSize: 12
        }}>/api/v1/stats</code> reachable).
            </div>
            <div style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap"
      }}>
              <input className="apikey-input" style={{
          flex: 1,
          minWidth: 260,
          marginBottom: 0
        }} placeholder={DEFAULT_INVIDIOUS_BASE} value={invidiousBase} onChange={e => {
          setInvidiousBase(e.target.value);
          setInvidiousStatus(null);
        }} />
              <button className="btn btn-ghost" disabled={invidiousChecking} onClick={() => checkInvidious(invidiousBase)} style={{
          opacity: invidiousChecking ? 0.5 : 1
        }}>
                {invidiousChecking ? "Checking…" : "Check"}
              </button>
              <button className="btn btn-primary" onClick={saveInvidiousBase}>
                Save
              </button>
            </div>

            {invidiousStatus && <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 12
      }}>
                <div style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          flexShrink: 0,
          background: invidiousStatus.ok ? "#48c774" : "#ff3860",
          boxShadow: invidiousStatus.ok ? "0 0 6px rgba(72,199,116,0.6)" : "0 0 6px rgba(255,56,96,0.6)"
        }} />
                <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: invidiousStatus.ok ? "#48c774" : "#ff3860"
        }}>
                  {invidiousStatus.msg}
                </span>
              </div>}

            {invidiousSaved && <div style={{
        marginTop: 10,
        fontSize: 13,
        color: "#48c774"
      }}>
                ✓ Saved
              </div>}
          </div>

          <Divider />

          {/* Auto-Watched Threshold */}
          <div style={{
      marginBottom: 40
    }}>
            <div className="settings-section-title">Auto-Watched Threshold</div>
            <div style={{
        fontSize: 13,
        color: "var(--text3)",
        marginBottom: 16,
        lineHeight: 1.6
      }}>
              A movie or episode is automatically marked as{" "}
              <span style={{
          color: "#48c774",
          fontWeight: 600
        }}>
                Watched ✓
              </span>{" "}
              when the remaining time drops to this value or below. Set between
              1 and 300 seconds.
            </div>
            <div style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        flexWrap: "wrap"
      }}>
              <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
                <input type="number" min={1} max={300} className="apikey-input" style={{
            width: 90,
            marginBottom: 0
          }} value={watchedThreshold} onChange={e => setWatchedThreshold(e.target.value)} />
                <span style={{
            fontSize: 14,
            color: "var(--text2)"
          }}>
                  seconds
                </span>
              </div>
              <button className="btn btn-primary" onClick={handleSaveThreshold}>
                Save
              </button>
            </div>
            {saved && <div style={{
        marginTop: 10,
        fontSize: 13,
        color: "#48c774"
      }}>
                ✓ Saved
              </div>}
          </div>

          <Divider />

          {/* Autoplay Next Episode */}
          <div style={{
      marginBottom: 40
    }}>
            <div className="settings-section-title">Autoplay Next Episode</div>
            <div style={{
        fontSize: 13,
        color: "var(--text3)",
        marginBottom: 16,
        lineHeight: 1.6
      }}>
              Configure how the player behaves when an episode finishes.
            </div>

            <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 16
      }}>
              {/* Enable/Disable Toggle */}
              <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12
        }}>
                <Toggle value={autoplayNextEnabled} onChange={val => {
            setAutoplayNextEnabled(val);
            storage.set(STORAGE_KEYS.AUTOPLAY_NEXT_ENABLED, val);
            flash();
          }} />
                <div>
                  <div style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text)"
            }}>
                    Enable Autoplay Next
                  </div>
                  <div style={{
              fontSize: 12,
              color: "var(--text3)",
              marginTop: 2
            }}>
                    Automatically play the next episode when the current one
                    ends.
                  </div>
                </div>
              </div>

              {autoplayNextEnabled && <>
                  {/* Duration input */}
                  <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 8
          }}>
                    <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text2)"
            }}>
                      Countdown Duration
                    </div>
                    <div style={{
              fontSize: 12,
              color: "var(--text3)",
              marginBottom: 4
            }}>
                      Number of seconds to display the countdown. Set to 0 to
                      only show the buttons and not autoplay automatically.
                    </div>
                    <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12
            }}>
                      <input type="number" min={0} max={60} className="apikey-input" style={{
                width: 90,
                marginBottom: 0
              }} value={autoplayNextDuration} onChange={e => setAutoplayNextDuration(e.target.value)} onBlur={() => {
                const num = Math.max(0, Math.min(60, parseInt(autoplayNextDuration, 10) || 0));
                setAutoplayNextDuration(num);
                storage.set(STORAGE_KEYS.AUTOPLAY_NEXT_DURATION, num);
                flash();
              }} />
                      <span style={{
                fontSize: 14,
                color: "var(--text2)"
              }}>
                        seconds
                      </span>
                    </div>
                  </div>

                  {/* Overlay Layout selection */}
                  <div style={{
            marginTop: 16
          }}>
                    <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text2)",
              marginBottom: 8
            }}>
                      Overlay Position
                    </div>
                    <div style={{
              fontSize: 12,
              color: "var(--text3)",
              marginBottom: 12
            }}>
                      Choose which side of the player the next episode thumbnail
                      and details are shown.
                    </div>
                    <SettingsSelect value={autoplayNextLayout} onChange={val => {
              setAutoplayNextLayout(val);
              storage.set(STORAGE_KEYS.AUTOPLAY_NEXT_LAYOUT, val);
              flash();
            }} options={[{
              value: "left",
              label: "Left Side"
            }, {
              value: "right",
              label: "Right Side"
            }]} />
                  </div>
                </>}
            </div>
          </div>

          <Divider />

          {/* Intro Skip */}
          <div style={{
      marginBottom: 40
    }}>
            <div className="settings-section-title">Anime Intro Skip</div>
            <div style={{
        fontSize: 13,
        color: "var(--text3)",
        marginBottom: 16,
        lineHeight: 1.6
      }}>
              Uses{" "}
              <span style={{
          color: "var(--text)",
          fontWeight: 600
        }}>
                AniSkip
              </span>{" "}
              to detect and skip opening/ending segments. Only active for animes
              and when using{" "}
              <span style={{
          color: "var(--text)",
          fontWeight: 600
        }}>
                AllManga
              </span>{" "}
              as source.
            </div>
            <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "0 16px"
      }}>
              {[{
          value: "off",
          label: "Off",
          desc: "Intro skip is disabled."
        }, {
          value: "auto",
          label: "Auto Skip",
          desc: "Automatically jumps past the intro/outro when reached."
        }, {
          value: "manual",
          label: "Manual Skip",
          desc: 'Shows a "Skip Intro" button at the bottom of the player.'
        }].map(({
          value,
          label,
          desc
        }, i, arr) => <div key={value} onClick={() => {
          setIntroSkipMode(value);
          storage.set(STORAGE_KEYS.INTRO_SKIP_MODE, value);
        }} style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "16px 0",
          borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
          cursor: "pointer"
        }}>
                  {/* Radio dot */}
                  <div style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: `2px solid ${introSkipMode === value ? "var(--red)" : "var(--border)"}`,
            background: introSkipMode === value ? "var(--red)" : "transparent",
            flexShrink: 0,
            marginTop: 1,
            boxShadow: introSkipMode === value ? "0 0 0 3px rgba(229,9,20,0.18)" : "none",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
                    {introSkipMode === value && <div style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#fff"
            }} />}
                  </div>
                  <div style={{
            flex: 1
          }}>
                    <div style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text)"
            }}>
                      {label}
                    </div>
                    <div style={{
              fontSize: 12,
              color: "var(--text3)",
              marginTop: 3,
              lineHeight: 1.5
            }}>
                      {desc}
                    </div>
                  </div>
                </div>)}
            </div>
          </div>
        </div>;
}
