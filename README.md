# Roast My GitHub 🔥

A web application that generates AI-powered roasts of GitHub profiles. Enter any GitHub username and receive a witty, accurate roast based on real repository data — delivered in one of five distinct styles.

---

## Overview

Roast My GitHub fetches a developer's public GitHub data, analyzes their repositories for recognizable patterns (abandoned projects, missing descriptions, zero stars, framework hopping), and sends a structured summary to an AI language model. The model then generates a roast grounded entirely in real data — no invented facts, no generic jokes.

The application is built as a lightweight Express server with a vanilla HTML/CSS/JS frontend and no client-side frameworks.

---

## Features

- **GitHub API integration** — fetches up to 100 public repositories per user, including language breakdown, star counts, fork counts, repository sizes, and descriptions
- **AI-generated roasts** — powered by Llama 3.3 70B via Groq's free-tier API
- **Five roast styles** — Classic Developer, Corporate Buzzwords, Pirate, Shakespeare, and Haiku, each with a distinct persona that visibly changes the tone
- **GitHub statistics card** — displays total repositories, total stars, most-used language, and total forks before the roast
- **Animated loading feed** — shows a sequential list of analysis steps as they appear to run, with a progress bar
- **Full error handling** — covers unknown users, zero-repo accounts, GitHub API failures, and AI API failures with friendly messages
- **No external frontend dependencies** — the entire UI is plain HTML, CSS, and JavaScript

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| Server | Express |
| Frontend | HTML, CSS, Vanilla JavaScript |
| AI | Llama 3.3 70B via Groq API |
| GitHub Data | GitHub REST API v3 |
| Environment | dotenv |
| Dev tooling | ts-node, nodemon |

Groq is used as the AI provider. The `openai` npm package is used as the HTTP client since Groq exposes a compatible API.

---

## Architecture

```
User Input
    │
    ▼
Express POST /api/roast
    │
    ├──► GitHub API (fetch user profile)
    ├──► GitHub API (fetch up to 100 repos)  ← parallel
    │
    ▼
analyzeRepos()
    Calculates:
    - total repos, stars, forks
    - language breakdown
    - repos with no description
    - empty repos (size === 0)
    - forked repos
    - top repos by stars
    - account age
    │
    ▼
buildPrompt()
    Combines:
    - style persona (e.g. "You are a savage senior engineer...")
    - structured data summary
    - explicit rules (no hallucinations, punchline format, word limit)
    │
    ▼
Groq API → Llama 3.3 70B
    │
    ▼
JSON response { roast, stats }
    │
    ▼
Frontend renders stats card + roast text
```

The server never sends raw repository arrays to the AI. It computes a compact summary first, which keeps the prompt focused and reduces token usage.

---

## Project Structure

```
roast-my-github/
│
├── src/
│   └── server.ts          # Express server, GitHub fetching, data analysis, prompt builder, API route
│
├── public/
│   ├── index.html         # Single-page UI with all four states (form, loading, error, result)
│   ├── style.css          # Dark theme, all component styles, loading feed animation
│   └── script.js          # Form handling, loading feed logic, fetch call, result rendering
│
├── .env                   # Local environment variables (not committed)
├── .env.example           # Template showing required variables
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

**`src/server.ts`** contains all backend logic in a single file to keep the architecture easy to read. It is divided into clearly labelled sections: types, GitHub helpers, data analysis, prompt builder, and the API route.

**`public/script.js`** manages four UI states — form, loading, error, result — and drives the animated loading feed that shows sequential analysis steps appearing one by one as the request processes.

---

## Installation

### Prerequisites

- Node.js 18 or higher
- A [Groq API key](https://console.groq.com) (free, no credit card required)
- Optionally, a [GitHub personal access token](https://github.com/settings/tokens) (increases rate limit from 60 to 5,000 requests/hour)

### Steps

**1. Clone the repository**

```bash
git clone https://github.com/your-username/roast-my-github.git
cd roast-my-github
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

```bash
cp .env.example .env
```

Open `.env` and fill in your keys (see [Environment Variables](#environment-variables) below).

**4. Start the development server**

```bash
npm run dev
```

**5. Open the application**

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | API key from [console.groq.com](https://console.groq.com) |
| `GITHUB_TOKEN` | No | GitHub personal access token — only needs `public_repo` scope. Increases rate limit from 60 to 5,000 req/hour |
| `PORT` | No | Port to run the server on. Defaults to `3000` |

Example `.env`:

```
GROQ_API_KEY=gsk_...
GITHUB_TOKEN=ghp_...
PORT=3000
```

---

## Usage

1. Open [http://localhost:3000](http://localhost:3000)
2. Enter any GitHub username in the input field
3. Select a roast style from the dropdown:
   - **Classic Developer** — dry senior engineer energy
   - **Corporate Buzzwords** — absurdly jargon-heavy
   - **Pirate** — full nautical roast speak
   - **Shakespeare** — Early Modern English dramatic flair
   - **Haiku** — five-seven-five syllable roasts
4. Click **Roast Me**
5. Watch the animated loading feed as the profile is analyzed
6. Read your roast and the GitHub statistics card above it

---

## Prompt Engineering

### Initial Brief

The project started from the following specification:

```
Create a polished MVP web application called Roast My GitHub.

Users enter a GitHub username and receive a funny, accurate, AI-generated
roast based on their public repositories and coding patterns.

The roast should feel like it was written by a witty senior engineer
reviewing someone's GitHub profile.

The goal is entertainment, but the roast must be grounded in real
repository data and never make up facts.

AI Prompt Requirements — the generated roast must:
- use only supplied GitHub data
- never invent repositories
- never invent technologies
- identify real patterns
- be funny and playful
- never become offensive
- never attack the person
- roast coding habits, not the human
- end with one genuine compliment

Examples of patterns worth mentioning:
- unfinished side projects
- many repositories with few commits
- tutorial projects
- excessive JavaScript usage
- framework hopping
- abandoned experiments
- too many TODO-style repositories
```

The initial implementation followed these requirements closely but the output was consistently polite and generic — observations dressed up as jokes with no real punchlines. The model was summarizing the data rather than roasting it.

### Final Prompt

The prompt sent to Groq (Llama 3.3 70B) is built dynamically from real GitHub data. The style persona at the top changes based on the user's selection. Below is the Classic Developer version:

```
You are a savage senior engineer who has reviewed one too many pull requests.
You have no patience for tutorial repos, empty projects, or zero-star graveyards.
You roast like a stand-up comedian who also knows what a merge conflict is.

Your target: "{username}". This is a full roast — go hard. Be specific, be savage,
be funny. Every joke must be grounded in the actual data below. Generic roasts are failure.

Evidence:
- Account age: {years}
- Own repos: {count} | Stars: {count} | Avg stars/repo: {count}
- Forks received: {count} | Forked repos: {count}
- Most used language: {language}
- Languages: {breakdown}
- Repos with no description: {count}/{total}
- Empty repos (size 0): {count}
- Followers: {count} | Bio: {bio}
- Repo names: {names}

Top repos:
- {name} ({stars} stars, {language}) — "{description}"

RULES:
1. Never invent repos, languages, or events not in the data above.
2. Find the most embarrassing patterns in this specific profile and mock them
   mercilessly — abandoned projects, empty repos, zero stars after years, no
   descriptions, tutorial clones, one-trick-pony language use, fork graveyards.
3. Write jokes with actual punchlines, not observations. "X has many repos" is
   an observation. "X has {count} repos and {stars} stars, which means their
   code has a 100% abandonment rate" is a joke.
4. Attack the code habits and decisions, never the person.
5. End with ONE backhanded compliment that sounds nice but still stings.
6. 120–160 words. Punchy. No filler sentences.

Write the roast:
```

### Key Changes

- **Sharper persona** — the style instruction was rewritten to be opinionated and vivid, which gives the model a stronger voice to write from
- **Observation vs. punchline rule** — rule 3 explicitly shows the model the difference between stating a fact and landing a joke, using the actual data values as the example
- **Backhanded compliment** — replacing "one genuine compliment" with "one backhanded compliment that still stings" kept the ending as part of the roast rather than an abrupt tonal shift
- **Word limit reduced** — cutting from 150–300 words to 120–160 words forced the model to drop filler and commit to only the sharpest observations
- **Anti-hallucination enforced** — the data block contains only pre-computed values pulled directly from the GitHub API, so the model has no gap to fill with invented facts

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Empty username input | Input field highlighted in red, focus returned, no request sent |
| GitHub user not found (404) | Friendly message: *"GitHub user not found"* |
| User has zero public repositories | Message: *"[username] has no public repositories to roast"* |
| GitHub API failure | Message: *"Could not reach the GitHub API. Try again later."* |
| AI API key missing or invalid | Message: *"AI API key is missing or invalid. Check GROQ_API_KEY in your .env file."* |
| Network error (server unreachable) | Message: *"Network error — make sure the server is running."* |

All errors display a friendly UI state with a Try Again button. No raw stack traces are ever exposed to the client.

The user-not-found case required a specific fix: because the GitHub user and repos requests run in parallel, both return 404 when the user does not exist. Both fetch functions now check for 404 independently and throw a `USER_NOT_FOUND` error so it is caught correctly regardless of which request resolves first.

---

## Future Improvements

- **Roast history** — store past roasts in a local database (SQLite) so users can revisit results without re-generating
- **Shareable links** — generate a unique URL per roast (e.g. `/roast/abc123`) that anyone can view
- **GitHub activity charts** — visualize commit frequency, language distribution, and star growth over time using a charting library
- **Repository quality scoring** — score each repo on a rubric (has description, has README, has recent commits, has tests) and include the score in the roast
- **Additional roast styles** — Gordon Ramsay, Yoda, motivational speaker, tech recruiter
- **Rate limiting** — prevent abuse by limiting requests per IP address
- **Caching** — cache GitHub data for a short TTL to reduce API calls for popular usernames
- **Dark/light mode toggle** — extend the existing CSS variable system to support a light theme

---

## Notes

This project was intentionally kept simple. There is no build step for the frontend, no client-side framework, and no database. Every architectural decision was made to favour clarity and reliability over abstraction.

The most significant engineering effort went into prompt design. Getting an AI to produce a roast that is both funny and honest — without inventing facts or defaulting to generic observations — required several iterations and explicit rules about the difference between an observation and a punchline.

The application is production-ready in the sense that it handles all realistic failure modes gracefully and presents a polished user experience. Scaling it further would require rate limiting, caching, and persistent storage, as outlined above.
