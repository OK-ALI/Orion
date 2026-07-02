# AI-Features Plan for Orion

> **Concept document:** This is retained as long-term product research, not an active release plan. Its internal version labels are illustrative phases, not Orion release numbers. The authoritative [Orion pre-AI roadmap](Orion-Pre-AI-Upgrade-Plan.md) keeps AI disabled through the current pre-AI milestones and governs release sequencing.

## Project

**Orion**  
**Tagline:** A Multiverse of Stories  
**Platform:** Desktop Streaming Application  
**AI Direction:** Local, private, non-LLM intelligence system

---

## Core Decision

Orion will **not use an LLM**.

The AI system will be built using:

- LanceDB
- Embeddings
- Metadata analysis
- Watch history
- User preference tracking
- Ranking algorithms
- Subtitle indexing
- Scene-level vector search
- Local recommendation logic
- Local storage only

This means Orion will not behave like a chatbot-style streaming app. Instead, it will behave like a **local cinematic intelligence system** that understands content, mood, user taste, time, and scene meaning without generating answers through an LLM.

---

## Is Orion Using RAG?

No. Orion will not use traditional RAG.

Traditional RAG means:

```text
Retrieval + LLM Generation
```

Orion will use:

```text
Retrieval + Ranking + Personalization
```

So Orion is better described as:

```text
Local Vector Intelligence Layer
```

or:

```text
LanceDB-powered Semantic Retrieval and Recommendation System
```

It is **RAG-like** in the sense that it retrieves relevant information from a vector database, but it does not include the generation step because there is no LLM.

---

## Selected AI Features

These are the planned AI features for Orion:

1. AI Search toggle inside search bar
2. AI Scan activation animation
3. Semantic Search
4. AI Mood Search
5. Personalized Recommendations
6. Time/day based Recommendations
7. Scene Search
8. Auto Library Organizer
9. Smart Continue Watching
10. AI Collections
11. Local LanceDB Intelligence Layer

Removed or avoided because Orion will not use an LLM:

- Chatbot-style Orion Guide
- AI-generated recaps
- Spoiler-free generated explanations
- Conversational Q&A
- LLM-written summaries

Instead of a chatbot guide, Orion should use smart UI cards, recommendation reasons, scene matches, mood tags, and collection logic.

---

# AI Search Behavior

## AI Search Off

When AI Search is off, Orion behaves like a normal streaming app search system.

It searches using:

```text
title
actor
series name
season
episode
genre
year
language
```

Example:

```text
User searches: Batman
```

Orion returns exact or close keyword matches:

```text
Batman Begins
The Dark Knight
The Batman
```

---

## AI Search On

When AI Search is turned on, Orion activates the local intelligence layer.

It searches using:

```text
semantic meaning
mood similarity
genre/theme matching
watch history
user preferences
time/day context
personalized ranking
scene/subtitle vectors
```

Example:

```text
User searches: dark emotional space movie
```

Orion understands the intent without an LLM by using embeddings and metadata ranking.

Process:

```text
1. Convert query into an embedding
2. Search LanceDB content vectors
3. Apply metadata filters such as genre, mood, runtime, language, type
4. Apply user preference ranking
5. Apply time/day context ranking
6. Return personalized results
```

Possible result:

```text
Interstellar
Arrival
Blade Runner 2049
Ad Astra
Gravity
```

---

# AI Scan

## Purpose

**AI Scan** is the short full-screen activation animation shown when the user turns on AI Search.

It visually communicates that Orion is switching from normal keyword search into local intelligence mode.

AI Scan does **not** mean Orion is using an LLM or actually reading the full display. It is a cinematic activation transition that represents Orion loading its local LanceDB intelligence layer, user preferences, mood search, semantic search, and personalized ranking.

---

## Activation UI Copy

When AI Search is turned on, show:

```text
AI Search On
AI Scan activated
Finding stories by mood, meaning, and your watch patterns.
```

This copy should appear during the short activation animation.

---

## Animation Behavior

When AI Search is enabled:

```text
User turns on AI Search
        ↓
AI Scan animation appears
        ↓
Soft ambient sound plays
        ↓
Orion loads local intelligence context
        ↓
Search bar enters AI Search mode
```

Recommended animation style:

- Full-screen dark overlay
- Soft red/cosmic glow expanding from the search bar
- Thin scanning lines moving across the screen
- Subtle particles or star-like dots
- Search bar glow after activation
- Smooth fade back into the app

Recommended duration:

```text
0.8s to 1.5s
```

The animation should feel calm, premium, and cinematic. It should not feel noisy, robotic, or distracting.

---

## Sound Behavior

Recommended sound direction:

- Soft low-frequency hum
- Calm airy pulse
- Subtle cinematic chime
- Deep gentle whoosh
- Space-like ambient tone

Avoid:

- Loud beeps
- Alarm sounds
- Harsh glitch effects
- Robotic transformer sounds

The sound should feel like Orion has quietly entered intelligence mode.

---

## AI Scan Settings

Users should be able to control this feature.

Settings:

```text
AI Scan Animation: On / Off
AI Scan Sound: On / Off
Animation Intensity: Minimal / Cinematic
Reduce Motion Mode: On / Off
```

Recommended behavior:

- Show AI Scan only when AI Search is turned on
- Do not show full-screen animation for every search query
- After AI Search is already active, use only a small search-bar pulse/loading effect
- Respect reduced motion settings

---

# Local LanceDB Intelligence Layer

## Main Role

LanceDB will act as Orion's local intelligence storage layer.

It stores embeddings and semantic relationships for:

- Movies
- Series
- Seasons
- Episodes
- Subtitles
- Scenes
- Moods
- Themes
- User taste profile
- AI Collections

LanceDB is not the whole AI system by itself. It becomes powerful when combined with metadata, watch history, ranking logic, and local algorithms.

---

## Storage Split

Orion should use both **SQLite** and **LanceDB**.

### SQLite stores structured app data

Use SQLite for exact, structured, transactional data:

```text
library_items
watch_history
playback_progress
user_likes
user_skips
search_history
app_settings
metadata_cache
file_paths
season_episode_structure
```

SQLite is better for records that need exact filtering, updating, and normal app logic.

---

### LanceDB stores semantic intelligence data

Use LanceDB for vectors, similarity search, and meaning-based matching:

```text
content embeddings
scene embeddings
subtitle embeddings
mood embeddings
theme embeddings
user taste embeddings
collection embeddings
semantic search index
similar content index
```

LanceDB is better for:

```text
Find similar movies
Find scenes by meaning
Search by mood
Build AI Collections
Match user taste
Recommend based on semantic similarity
```

---

## User Preferences Storage

Yes, user preferences will be stored locally.

### Structured preferences in SQLite

SQLite should store clear preference signals:

```text
liked titles
skipped titles
completed titles
rewatched titles
favorite genres
preferred runtime
preferred language
preferred content type
watch time patterns
search history
manual dislikes
hidden titles
```

Example:

```text
User often watches sci-fi and mystery at night.
User skips slow romance movies.
User completes more 90-140 minute movies.
```

---

### Semantic preferences in LanceDB

LanceDB should store meaning-based taste vectors:

```text
user_taste_embedding
favorite_mood_embedding
favorite_theme_embedding
recent_watch_embedding
night_watch_embedding
weekend_watch_embedding
```

This allows Orion to understand taste beyond simple genres.

Example:

```text
User likes:
- dark sci-fi
- emotional mystery
- cinematic thrillers
- time travel stories
- late-night immersive movies
```

Even if the genre is different, Orion can still find similar-feeling content.

---

# LanceDB Tables

## 1. content_index

Stores semantic information about movies, series, seasons, and episodes.

```text
id
title
type
year
genres
overview
cast
director
language
runtime
rating
mood_tags
theme_tags
pace
poster_path
file_path
embedding
```

Used for:

- Semantic Search
- AI Mood Search
- Personalized Recommendations
- AI Collections
- Similar content discovery

---

## 2. scene_index

Stores subtitle and scene-level chunks.

```text
id
content_id
season
episode
start_time
end_time
subtitle_text
scene_keywords
characters
mood_tags
embedding
```

Used for:

- Scene Search
- Dialogue Search
- Timestamp jump
- Moment search

---

## 3. user_taste_profile

Stores user taste vectors and preference summaries.

```text
user_id
favorite_genres
favorite_moods
favorite_themes
preferred_runtime
preferred_languages
preferred_watch_times
avoid_tags
taste_embedding
recent_watch_embedding
night_watch_embedding
weekend_watch_embedding
```

Used for:

- Personalized Recommendations
- Time/day Recommendations
- AI Collections
- Smart ranking

---

## 4. collections_index

Stores dynamic AI Collections.

```text
collection_id
collection_name
description
mood
theme
rules
content_ids
collection_embedding
updated_at
```

Used for:

- AI Collections
- Home screen rows
- Mood-based discovery
- Similar-content groups

---

# Planned AI Features

## 1. Semantic Search

Semantic Search allows users to search by meaning instead of exact title.

Example queries:

```text
space movie about survival
dark detective story
movie about dreams and reality
emotional sci-fi with family theme
```

How it works:

```text
query → embedding → LanceDB vector search → metadata filters → ranked results
```

No LLM is required.

---

## 2. AI Mood Search

AI Mood Search allows users to find content by feeling, tone, and atmosphere.

Example queries:

```text
something dark and cinematic
fun movie for family night
sad but beautiful movie
mind-bending thriller
late-night mystery
```

Mood tags can be built using:

- TMDB genres
- TMDB keywords
- manual mood rules
- subtitle keyword analysis
- embedding similarity
- user behavior signals

---

## 3. Personalized Recommendations

Orion learns from local user behavior.

Signals:

```text
watched titles
completed titles
skipped titles
rewatched titles
liked titles
search history
watch duration
preferred runtime
preferred genres
preferred moods
```

Recommendation scoring:

```text
final_score =
semantic_similarity
+ genre_preference_score
+ mood_preference_score
+ watch_history_score
+ completion_score
- recently_watched_penalty
```

---

## 4. Time/Day Based Recommendations

Orion should monitor time and day to adjust recommendations.

Examples:

```text
Morning → short, light episodes
Evening → relaxed movies or continuing series
Late night → dark, cinematic, immersive stories
Weekend → bingeable series and longer movies
```

Scoring:

```text
final_score =
base_recommendation_score
+ time_context_score
+ day_context_score
+ user_pattern_score
```

This feature makes Orion feel personally aware without using a chatbot.

---

## 5. Smart Continue Watching

Smart Continue Watching improves resume behavior.

Basic behavior:

```text
Resume from 01:24:12
```

Smart behavior:

```text
Resume from 01:24:12
Replay last 30 seconds
Replay last scene boundary
Continue next episode
```

Long-gap behavior:

```text
You last watched this 12 days ago.
Resume from 42:18 or replay the last 60 seconds?
```

No generated recap is required.

---

## 6. Scene Search

Scene Search uses subtitle chunks and embeddings.

Example queries:

```text
scene where they talk about the black hole
find the hospital scene
fight scene in episode 3
where he says goodbye
portal opening scene
```

How it works:

```text
subtitle extraction
        ↓
chunk subtitles with timestamps
        ↓
generate embeddings
        ↓
store in LanceDB scene_index
        ↓
query scene vectors
        ↓
show timestamp results
```

Result example:

```text
Episode 4 · 18:32
Possible match: characters discuss the strange signal before entering the portal.
[Jump to Scene]
```

---

## 7. Auto Library Organizer

Auto Library Organizer improves local library quality.

It can detect:

```text
messy filenames
wrong titles
duplicate content
missing posters
wrong episode order
unknown seasons
quality duplicates
franchise grouping
mood categories
```

Example:

```text
Interstellar.2014.1080p.BluRay.x264.mkv
```

Orion extracts:

```text
Title: Interstellar
Year: 2014
Type: Movie
Quality: 1080p
Mood: emotional, cinematic, space
Collection: Mind-Bending Sci-Fi
```

Use review mode:

```text
Orion found 14 library improvements.
Review before applying?
```

AI should never silently reorganize the user's library without permission.

---

## 8. AI Collections

AI Collections are dynamic smart collections created from content metadata, embeddings, user taste, mood, time, and watch history.

Examples:

```text
Late Night Sci-Fi
Mind-Bending Stories
Weekend Binge
Fast Action Under 2 Hours
Comfort Rewatch
Dark Cinematic Picks
Movies Like Interstellar
Emotional Space Movies
Short Weekday Episodes
```

Collection generation logic:

```text
1. Cluster content by embeddings
2. Apply mood/theme rules
3. Apply user preference patterns
4. Apply time/day context
5. Create smart rows for home screen
```

No LLM is needed. Collection names can use predefined templates.

Example templates:

```text
Late Night {Genre}
{Mood} Stories
Movies Like {Title}
{Runtime} Picks
Weekend {Type}
{Theme} Collection
```

---

# Version Roadmap

## v1.0.0: Core Streaming App

### Goal

Build the stable non-AI Orion streaming app.

### Features

```text
Movie and series library
Home screen
Normal search
Movie/series detail page
Custom video player
Continue watching
Recently added
Watch history
Metadata support
Posters and thumbnails
Season/episode browsing
Basic filters
Basic categories
Settings page
```

### AI Status

```text
No active AI features.
```

### Hidden Foundation

Even in v1.0.0, collect useful local data for later AI features:

```text
watch progress
completion percentage
watch time/day
search history
skips
rewatches
likes/dislikes if available
subtitle availability
metadata quality
```

---

## v1.1.0: Local Intelligence Foundation

### Goal

Add LanceDB and prepare the non-LLM intelligence layer.

### Planned AI Features

```text
LanceDB setup
content_index table
embedding pipeline
metadata normalization
AI Search toggle UI
AI Scan activation animation
local intelligence settings
```

### User-visible changes

```text
AI Search toggle appears inside search bar
AI Scan animation appears when AI Search is turned on
AI Search can be marked Experimental
```

---

## v1.2.0: Semantic Search + AI Mood Search

### Goal

Make AI Search useful.

### Planned AI Features

```text
Semantic Search
AI Mood Search
Hybrid search
mood tags
theme tags
similar title search
AI Search result ranking
```

Example searches:

```text
space movie about survival
dark emotional thriller
mind-bending movie under 2 hours
something cinematic for night
```

---

## v1.3.0: Personalized Recommendations

### Goal

Make Orion learn from user behavior.

### Planned AI Features

```text
watch history analysis
genre preference scoring
mood preference scoring
runtime preference scoring
similar-content rows
because-you-watched rows
user_taste_profile table
```

Home rows:

```text
Because You Watched
Your Sci-Fi Picks
Dark Stories For You
Continue This Mood
Similar To Your Recent Watches
```

---

## v1.4.0: Time/Day Recommendations

### Goal

Make Orion context-aware.

### Planned AI Features

```text
morning recommendations
evening recommendations
late-night recommendations
weekend binge recommendations
short weekday episode suggestions
time/day ranking boost
```

Example:

```text
Saturday night → longer cinematic movies or bingeable series
Weekday morning → short, light episodes
Late night → dark, immersive stories
```

---

## v1.5.0: Smart Continue Watching

### Goal

Improve resume behavior.

### Planned AI Features

```text
replay last 30 seconds
resume from last scene boundary
long-gap detection
continue next episode
unfinished session detection
smart resume cards
```

No generated recaps because Orion does not use an LLM.

---

## v1.6.0: Scene Search

### Goal

Allow users to search inside movies and episodes.

### Planned AI Features

```text
subtitle indexing
scene chunks
timestamp search
dialogue search
moment search
jump to scene
scene_index table
```

Example:

```text
Find the scene where they mention the portal
```

Orion searches subtitle embeddings and returns timestamp matches.

---

## v1.7.0: Auto Library Organizer

### Goal

Make Orion clean and organize the local library.

### Planned AI Features

```text
duplicate detection
wrong metadata detection
filename parsing
season/episode correction
mood tagging
franchise grouping
quality detection
library improvement review mode
```

Important:

```text
Always ask user before applying major library changes.
```

---

## v1.8.0: AI Collections

### Goal

Create dynamic smart collections.

### Planned AI Features

```text
dynamic mood collections
time-based collections
taste-based collections
franchise collections
similar-content collections
home screen smart rows
collections_index table
```

Examples:

```text
Late Night Sci-Fi
Mind-Bending Stories
Weekend Binge
Fast Action Under 2 Hours
Dark Cinematic Picks
```

---

## v2.0.0: Unified Local Intelligence Layer

### Goal

Bring all non-LLM AI systems together into one polished experience.

### Complete AI Feature Set

```text
AI Search toggle
AI Scan animation
Semantic Search
AI Mood Search
Scene Search
Personalized Recommendations
Time/day Recommendations
Smart Continue Watching
Auto Library Organizer
AI Collections
Local LanceDB Intelligence Layer
User Preference Intelligence
```

### v2.0.0 Identity

By v2.0.0, Orion should feel like:

```text
A local AI-powered story discovery and streaming desktop app without an LLM.
```

It should not feel like a chatbot. It should feel like a private cinematic intelligence system that understands what the user likes, when they watch, what mood they are in, and what scenes or stories they are trying to find.

---

# Recommended Architecture

```text
Orion Desktop App
        ↓
Search Bar / Home / Player / Library
        ↓
AI Feature Controller
        ↓
Local Intelligence Layer
        ↓
SQLite + LanceDB
        ↓
Embeddings + Metadata + Watch History + Ranking Logic
```

---

## AI Search Flow

```text
User turns AI Search On
        ↓
AI Scan animation appears
        ↓
AI Search mode activates
        ↓
User enters natural query
        ↓
Query embedding is generated
        ↓
LanceDB retrieves similar content/scenes
        ↓
Metadata filters are applied
        ↓
User preference ranking is applied
        ↓
Time/day ranking is applied
        ↓
Orion displays personalized results
```

---

## AI Search UI Copy

Search bar placeholder when AI Search is off:

```text
Search movies, series...
```

Search bar placeholder when AI Search is on:

```text
Search by mood, meaning, or scene...
```

AI Scan activation text:

```text
AI Search On
AI Scan activated
Finding stories by mood, meaning, and your watch patterns.
```

---

# Final Direction

Orion should not chase chatbot AI.

Its AI should be quiet, fast, useful, and local.

Best positioning:

```text
Orion uses a local LanceDB-powered intelligence layer for semantic search, scene retrieval, mood matching, personalized recommendations, smart collections, and time-aware ranking without using an LLM.
```

The product identity should be:

```text
First, make Orion useful.
Then, make Orion intelligent.
Finally, make Orion personal.
```
