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
import { secureStorage } from "../../../src/renderer/services/settingsStore";

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
  it("preserves explicit source and quality selections through preflight", async () => {
    setOrionStorage("downloadPath", "C:\\Orion Downloads");

    const alternateCandidate = {
      ...candidate,
      id: "hls-2",
      host: "alternate.example",
      rankReason: "Alternate captured source",
      score: 10,
      capturedAt: 101,
    };

    const bridge = createElectronBridge();

    bridge.listStreamCandidates.mockResolvedValue([
      candidate,
      alternateCandidate,
    ]);

    window.electron = bridge;

    render(
      <DownloadModal
        {...baseProps}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Choose captured source (2)",
      }),
    );

    const alternateOption = screen.getByRole("option", {
      name: /alternate\.example/i,
    });

    const sourceSelect = alternateOption.closest("select");

    expect(sourceSelect).not.toBeNull();

    fireEvent.change(sourceSelect, {
      target: { value: "hls-2" },
    });

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Quality",
      }),
      {
        target: { value: "1080" },
      },
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Start download",
      }),
    );

    await waitFor(() => {
      expect(bridge.runDownload).toHaveBeenCalledOnce();
    });

    expect(bridge.preflightStream).toHaveBeenCalledOnce();
    expect(bridge.preflightStream).toHaveBeenCalledWith("hls-2");

    const payload = bridge.runDownload.mock.calls[0][0];

    expect(payload.candidateId).toBe("hls-2");
    expect(payload.qualityPreset).toBe("1080");

    expect(
      JSON.parse(localStorage.getItem("orion_downloadQuality")),
    ).toBe("1080");
  });

  it("blocks download start when candidate preflight rejects", async () => {
    setOrionStorage("downloadPath", "C:\\Orion Downloads");

    const bridge = createElectronBridge({
      preflightStream: vi.fn().mockResolvedValue({
        ok: false,
        error: "Contract preflight rejection",
      }),
    });

    window.electron = bridge;

    const onClose = vi.fn();

    render(
      <DownloadModal
        {...baseProps}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Start download",
      }),
    );

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(
      "Contract preflight rejection",
    );

    expect(bridge.preflightStream).toHaveBeenCalledOnce();
    expect(bridge.preflightStream).toHaveBeenCalledWith("hls-1");
    expect(bridge.runDownload).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("preserves automatic subtitle search and selected subtitle payload", async () => {
    setOrionStorage("downloadPath", "C:\\Orion Downloads");
    setOrionStorage("subtitleDownload", 1);
    setOrionStorage("subtitleLang", "en");

    const searchedSubtitle = {
      file_id: "searched-subtitle-1",
      direct_url: "https://subs.example/searched-en.srt",
      language: "en",
      release: "Searched English",
    };

    vi.spyOn(secureStorage, "get").mockImplementation(
      async (key) => (
        key === "subdlApiKey"
          ? "subdl-contract-key"
          : null
      ),
    );

    const bridge = createElectronBridge({
      searchSubtitles: vi.fn().mockResolvedValue({
        ok: true,
        results: [searchedSubtitle],
      }),
    });

    window.electron = bridge;

    render(
      <DownloadModal
        {...baseProps}
        subtitles={[]}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(bridge.searchSubtitles).toHaveBeenCalledOnce();
    });

    expect(bridge.searchSubtitles).toHaveBeenCalledWith({
      tmdbId: 321,
      mediaType: "movie",
      season: null,
      episode: null,
      languages: "en",
      subdlApiKey: "subdl-contract-key",
      wyzieApiKey: "",
    });

    await screen.findByText(
      "1 subtitle option found. The preferred match is selected.",
    );

    expect(screen.getByRole("checkbox")).toBeChecked();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Start download",
      }),
    );

    await waitFor(() => {
      expect(bridge.runDownload).toHaveBeenCalledOnce();
    });

    expect(
      bridge.runDownload.mock.calls[0][0].subtitles,
    ).toEqual([searchedSubtitle]);
  });

  it("preserves the captured URL fallback when no candidate is available", async () => {
    setOrionStorage("downloadPath", "C:\\Orion Downloads");

    const bridge = createElectronBridge();

    bridge.listStreamCandidates.mockResolvedValue([]);

    window.electron = bridge;

    render(
      <DownloadModal
        {...baseProps}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Start download",
      }),
    );

    await waitFor(() => {
      expect(bridge.runDownload).toHaveBeenCalledOnce();
    });

    expect(bridge.preflightStream).not.toHaveBeenCalled();

    const payload = bridge.runDownload.mock.calls[0][0];

    expect(payload.candidateId).toBeUndefined();
    expect(payload.m3u8Url).toBe(
      "https://fallback.example/master.m3u8",
    );

    expect(payload.m3u8Context).toEqual({
      candidateId: "hls-1",
      source: "contract-test",
    });

    expect(payload.downloadStrategy).toBe("auto");
  });

  it("cancel closes without starting or preflighting a download", () => {
    const bridge = createElectronBridge();

    window.electron = bridge;

    const onClose = vi.fn();

    render(
      <DownloadModal
        {...baseProps}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(onClose).toHaveBeenCalledOnce();
    expect(bridge.preflightStream).not.toHaveBeenCalled();
    expect(bridge.runDownload).not.toHaveBeenCalled();
  });
});