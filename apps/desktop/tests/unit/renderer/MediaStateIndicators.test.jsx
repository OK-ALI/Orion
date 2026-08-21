import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MediaCard from "../../../src/renderer/components/media/MediaCard";
import SearchResultRow from "../../../src/renderer/components/media/SearchResultRow";
import {
  getWatchedPresentationKey,
  isMediaItemWatched,
} from "../../../src/renderer/shared/utils/library";

const movie = {
  id: 10,
  media_type: "movie",
  title: "State Film",
  release_date: "2024-01-01",
  poster_path: null,
};

const episode = {
  id: 20,
  media_type: "tv",
  name: "State Series",
  season: 2,
  episode: 3,
  first_air_date: "2024-01-01",
  poster_path: null,
};

describe("Desktop media-state presentation", () => {
  it("uses canonical local watched keys for movies and exact episodes", () => {
    expect(getWatchedPresentationKey(movie)).toBe("movie_10");
    expect(getWatchedPresentationKey(episode)).toBe("tv_20_s2e3");
  });

  it("does not guess title-level TV watched state without complete episode metadata", () => {
    expect(isMediaItemWatched(
      { id: 20, media_type: "tv", name: "State Series" },
      { tv_20_s1e1: true },
    )).toBe(false);
  });

  it("proves title-level TV watched state only when every known non-special episode is watched", () => {
    const series = {
      id: 20,
      media_type: "tv",
      name: "State Series",
      seasons: [
        { season_number: 0, episode_count: 2 },
        { season_number: 1, episode_count: 2 },
        { season_number: 2, episode_count: 1 },
      ],
    };

    expect(isMediaItemWatched(series, {
      tv_20_s1e1: true,
      tv_20_s1e2: true,
      tv_20_s2e1: true,
    })).toBe(true);

    expect(isMediaItemWatched(series, {
      tv_20_s1e1: true,
      tv_20_s1e2: true,
    })).toBe(false);
  });

  it("shows My List and Watched together without changing the card interaction contract", () => {
    render(
      <MediaCard
        item={movie}
        inMyList
        watched={{ movie_10: true }}
        onClick={() => {}}
      />,
    );

    expect(screen.getByLabelText("Open State Film, in My List, watched")).toBeInTheDocument();
    expect(document.querySelector('[data-media-state="saved"]')).toBeInTheDocument();
    expect(document.querySelector('[data-media-state="watched"]')).toBeInTheDocument();
  });

  it("updates visible card state when canonical props change without remounting", () => {
    const { rerender } = render(
      <MediaCard item={movie} watched={{}} inMyList={false} onClick={() => {}} />,
    );

    expect(document.querySelector('[data-media-state="saved"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-media-state="watched"]')).not.toBeInTheDocument();

    rerender(
      <MediaCard item={movie} watched={{ movie_10: true }} inMyList onClick={() => {}} />,
    );

    expect(document.querySelector('[data-media-state="saved"]')).toBeInTheDocument();
    expect(document.querySelector('[data-media-state="watched"]')).toBeInTheDocument();
  });

  it("uses compact non-interactive state indicators in quick-search rows", () => {
    render(
      <SearchResultRow
        result={movie}
        active={false}
        duplicateTitle={false}
        onActivate={() => {}}
        onHover={() => {}}
        inMyList
        watched
      />,
    );

    expect(screen.getByLabelText("In My List, Watched")).toBeInTheDocument();
    expect(document.querySelector(".search-result-trailing .media-state-indicators--inline")).toBeInTheDocument();
  });
});
