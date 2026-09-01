import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import DownloadModal from "../../../src/renderer/components/DownloadModal";

const candidate = {
  id: "hls-1",
  kind: "hls",
  host: "video.example",
  rankReason: "Preferred HLS candidate",
  score: 90,
  capturedAt: 100,
};

const subtitle = {
  file_id: "subtitle-1",
  direct_url: "https://subs.example/en.srt",
  language: "en",
  release: "Example English",
};

function setOrionStorage(key, value) {
  localStorage.setItem(`orion_${key}`, JSON.stringify(value));
}

function createElectronBridge(overrides = {}) {
  return {
    listStreamCandidates: vi.fn().mockResolvedValue([candidate]),
    getDownloaderStatus: vi.fn().mockResolvedValue({
      exists: true,
      version: "test",
    }),
    preflightStream: vi.fn().mockResolvedValue({
      ok: true,
      strategy: "native-hls",
    }),
    runDownload: vi.fn().mockResolvedValue({
      ok: true,
      download: {
        id: "download-1",
        name: "Contract Movie",
        status: "downloading",
      },
    }),
    pickFolder: vi.fn().mockResolvedValue("D:\\Orion Downloads"),
    ...overrides,
  };
}

const baseProps = {
  captureSessionId: "capture-1",
  m3u8Url: "https://fallback.example/master.m3u8",
  m3u8Context: {
    candidateId: "hls-1",
    source: "contract-test",
  },
  subtitles: [subtitle],
  mediaName: "Contract Movie",
  mediaId: "movie-321",
  mediaType: "movie",
  season: null,
  episode: null,
  posterPath: "/poster.jpg",
  tmdbId: 321,
  expectedDurationSeconds: 1610,
  expectedDurationConfidence: "exact",
};

describe("DownloadModal contract", () => {
  beforeEach(() => {
    localStorage.clear();
    window.electron = undefined;
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    window.electron = undefined;
    vi.restoreAllMocks();
  });

  it("preserves the complete downloader bridge payload", async () => {
    setOrionStorage("downloadPath", "C:\\Orion Downloads");
    setOrionStorage("downloadQuality", "720");
    setOrionStorage("downloadConcurrency", 3);
    setOrionStorage("downloadFragmentConcurrency", 8);

    const bridge = createElectronBridge();
    window.electron = bridge;

    const onClose = vi.fn();
    const onDownloadStarted = vi.fn();

    render(
      <DownloadModal
        {...baseProps}
        onClose={onClose}
        onDownloadStarted={onDownloadStarted}
      />,
    );

    const startButton = await screen.findByRole("button", {
      name: "Start download",
    });

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(bridge.runDownload).toHaveBeenCalledOnce();
    });

    expect(bridge.listStreamCandidates).toHaveBeenCalledWith({
      sessionId: "capture-1",
    });

    expect(bridge.preflightStream).toHaveBeenCalledOnce();
    expect(bridge.preflightStream).toHaveBeenCalledWith("hls-1");

    const payload = bridge.runDownload.mock.calls[0][0];

    expect(Object.keys(payload).sort()).toEqual(
      [
        "candidateId",
        "concurrency",
        "downloadPath",
        "downloadStrategy",
        "downloaderEngine",
        "episode",
        "expectedDurationConfidence",
        "expectedDurationSeconds",
        "fragmentConcurrency",
        "m3u8Context",
        "m3u8Url",
        "mediaId",
        "mediaType",
        "name",
        "posterPath",
        "qualityPreset",
        "season",
        "subtitles",
        "tmdbId",
      ].sort(),
    );

    expect(payload).toEqual({
      candidateId: "hls-1",
      m3u8Url: undefined,
      m3u8Context: undefined,
      name: "Contract Movie",
      downloadPath: "C:\\Orion Downloads",
      mediaId: "movie-321",
      mediaType: "movie",
      season: null,
      episode: null,
      posterPath: "/poster.jpg",
      tmdbId: 321,
      expectedDurationSeconds: 1610,
      expectedDurationConfidence: "exact",
      qualityPreset: "720",
      concurrency: 3,
      fragmentConcurrency: 8,
      downloadStrategy: "native-hls",
      subtitles: [subtitle],
      downloaderEngine: "auto",
    });

    expect(onDownloadStarted).toHaveBeenCalledOnce();
    expect(onDownloadStarted).toHaveBeenCalledWith({
      id: "download-1",
      name: "Contract Movie",
      status: "downloading",
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("preserves user-selected destination ownership", async () => {
    setOrionStorage("downloadQuality", "best");

    const bridge = createElectronBridge();
    window.electron = bridge;

    const onClose = vi.fn();

    render(
      <DownloadModal
        {...baseProps}
        subtitles={[]}
        onClose={onClose}
      />,
    );

    await screen.findByRole("button", {
      name: "Start download",
    });

    const chooseFolderButton = screen.getByRole("button", {
      name: /Choose folder/i,
    });

    fireEvent.click(chooseFolderButton);

    await waitFor(() => {
      expect(bridge.pickFolder).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "D:\\Orion Downloads",
        }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Start download",
      }),
    );

    await waitFor(() => {
      expect(bridge.runDownload).toHaveBeenCalledOnce();
    });

    const payload = bridge.runDownload.mock.calls[0][0];

    expect(payload.downloadPath).toBe("D:\\Orion Downloads");
    expect(payload.qualityPreset).toBe("best");
    expect(payload.concurrency).toBe(2);
    expect(payload.fragmentConcurrency).toBe(6);

    expect(
      JSON.parse(localStorage.getItem("orion_downloadPath")),
    ).toBe("D:\\Orion Downloads");
  });
});