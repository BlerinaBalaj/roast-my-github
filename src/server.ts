import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import GroqClient from "openai";

// Explicitly resolve path so dotenv works regardless of cwd
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

function getAIClient(): { client: GroqClient; model: string } {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set in your .env file.");
  return {
    client: new GroqClient({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" }),
    model: "llama-3.3-70b-versatile",
  };
}

// ---------- Types ----------

interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  size: number;
  updated_at: string;
  created_at: string;
  topics?: string[];
  open_issues_count: number;
}

interface GitHubUser {
  login: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

interface RepoSummary {
  totalRepos: number;
  totalStars: number;
  totalForks: number;
  mostUsedLanguage: string;
  topRepos: { name: string; stars: number; language: string | null; description: string | null }[];
  languageBreakdown: Record<string, number>;
  reposWithNoDescription: number;
  reposWithNoCommits: number; // size === 0
  forkedRepos: number;
  averageStars: number;
  accountAgeYears: number;
  repoNames: string[];
  bio: string | null;
  followerCount: number;
}

// ---------- GitHub helpers ----------

async function fetchGitHubUser(username: string): Promise<GitHubUser> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "roast-my-github/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers });

  if (res.status === 404) throw new Error("USER_NOT_FOUND");
  if (!res.ok) throw new Error(`GITHUB_API_ERROR:${res.status}`);

  return res.json() as Promise<GitHubUser>;
}

async function fetchGitHubRepos(username: string): Promise<GitHubRepo[]> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "roast-my-github/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // Fetch up to 100 repos (max per page)
  const res = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
    { headers }
  );

  if (res.status === 404) throw new Error("USER_NOT_FOUND");
  if (!res.ok) throw new Error(`GITHUB_API_ERROR:${res.status}`);

  return res.json() as Promise<GitHubRepo[]>;
}

function analyzeRepos(user: GitHubUser, repos: GitHubRepo[]): RepoSummary {
  const ownRepos = repos.filter((r) => !r.fork);

  const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0);
  const totalForks = ownRepos.reduce((sum, r) => sum + r.forks_count, 0);

  // Language breakdown (count of repos per language)
  const langCount: Record<string, number> = {};
  for (const r of ownRepos) {
    if (r.language) {
      langCount[r.language] = (langCount[r.language] || 0) + 1;
    }
  }

  const mostUsedLanguage =
    Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

  const topRepos = [...ownRepos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5)
    .map((r) => ({
      name: r.name,
      stars: r.stargazers_count,
      language: r.language,
      description: r.description,
    }));

  const reposWithNoDescription = ownRepos.filter((r) => !r.description || r.description.trim() === "").length;
  const reposWithNoCommits = ownRepos.filter((r) => r.size === 0).length;

  const accountAgeYears = Math.floor(
    (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365)
  );

  return {
    totalRepos: ownRepos.length,
    totalStars,
    totalForks,
    mostUsedLanguage,
    topRepos,
    languageBreakdown: langCount,
    reposWithNoDescription,
    reposWithNoCommits,
    forkedRepos: repos.length - ownRepos.length,
    averageStars: ownRepos.length > 0 ? Math.round(totalStars / ownRepos.length) : 0,
    accountAgeYears,
    repoNames: ownRepos.slice(0, 20).map((r) => r.name),
    bio: user.bio,
    followerCount: user.followers,
  };
}

// ---------- Prompt builder ----------

type RoastStyle = "classic" | "corporate" | "pirate" | "shakespeare" | "haiku";

const styleInstructions: Record<RoastStyle, string> = {
  classic:
    "You are a savage senior engineer who has reviewed one too many pull requests. You have no patience for tutorial repos, empty projects, or zero-star graveyards. You roast like a stand-up comedian who also knows what a merge conflict is.",
  corporate:
    "You are an insufferable tech lead who communicates entirely in corporate buzzwords. Roast the profile using phrases like 'synergize', 'leverage', 'disruptive', 'move the needle', 'circle back', 'boil the ocean', and 'low-hanging fruit' — but make each buzzword land as a genuine burn.",
  pirate:
    "Ye be a foul-mouthed pirate captain who has plundered better GitHub profiles than this. Roast the landlubber in full pirate speak — 'arr', 'blimey', 'shiver me timbers', 'Davy Jones' locker'. Use the sea as metaphor for their coding career sinking slowly.",
  shakespeare:
    "Thou art the ghost of Shakespeare, horrified by what thou hast witnessed on this profile. Deliver thy roast in dramatic Early Modern English — 'thee', 'thou', 'forsooth', 'methinks', 'hath', 'doth'. Be theatrical. Be devastating. Be the Bard.",
  haiku:
    "You speak only in haiku (5-7-5 syllables, strictly). Write 4–5 haikus, each one a precise, devastating observation about the profile. Every syllable must cut.",
};

function buildPrompt(username: string, summary: RepoSummary, style: RoastStyle): string {
  const styleInstruction = styleInstructions[style];

  const langList = Object.entries(summary.languageBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `${lang} (${count} repos)`)
    .join(", ");

  const topRepoList = summary.topRepos
    .map((r) => `- ${r.name} (${r.stars} stars, ${r.language ?? "no language"}) — "${r.description ?? "no description"}"`)
    .join("\n");

  return `${styleInstruction}

Your target: "${username}". This is a full roast — go hard. Be specific, be savage, be funny. Every joke must be grounded in the actual data below. Generic roasts are failure.

Evidence:
- Account age: ${summary.accountAgeYears} year(s)
- Own repos: ${summary.totalRepos} | Stars: ${summary.totalStars} | Avg stars/repo: ${summary.averageStars}
- Forks received: ${summary.totalForks} | Forked repos: ${summary.forkedRepos}
- Most used language: ${summary.mostUsedLanguage}
- Languages: ${langList || "none detected"}
- Repos with no description: ${summary.reposWithNoDescription}/${summary.totalRepos}
- Empty repos (size 0): ${summary.reposWithNoCommits}
- Followers: ${summary.followerCount} | Bio: ${summary.bio ?? "none"}
- Repo names: ${summary.repoNames.join(", ") || "none"}

Top repos:
${topRepoList || "Nothing worth starring."}

RULES:
1. Never invent repos, languages, or events not in the data above.
2. Find the most embarrassing patterns in this specific profile and mock them mercilessly — abandoned projects, empty repos, zero stars after years, no descriptions, tutorial clones, one-trick-pony language use, fork graveyards.
3. Write jokes with actual punchlines, not observations. "X has many repos" is an observation. "X has ${summary.totalRepos} repos and ${summary.totalStars} stars, which means their code has a 100% abandonment rate" is a joke.
4. Attack the code habits and decisions, never the person.
5. End with ONE backhanded compliment that sounds nice but still stings.
6. 120–160 words. Punchy. No filler sentences.

Write the roast:`;
}

// ---------- API route ----------

app.post("/api/roast", async (req: Request, res: Response): Promise<void> => {
  const { username, style } = req.body as { username?: string; style?: string };

  if (!username || typeof username !== "string" || username.trim() === "") {
    res.status(400).json({ error: "Please enter a GitHub username." });
    return;
  }

  const cleanUsername = username.trim();
  const roastStyle: RoastStyle = (["classic", "corporate", "pirate", "shakespeare", "haiku"].includes(style ?? "")
    ? style
    : "classic") as RoastStyle;

  try {
    // Fetch user profile and repos in parallel
    const [user, repos] = await Promise.all([
      fetchGitHubUser(cleanUsername),
      fetchGitHubRepos(cleanUsername),
    ]);

    if (repos.length === 0 && user.public_repos === 0) {
      res.status(422).json({ error: `${cleanUsername} has no public repositories to roast.` });
      return;
    }

    const summary = analyzeRepos(user, repos);
    const prompt = buildPrompt(cleanUsername, summary, roastStyle);

    const { client: aiClient, model: aiModel } = getAIClient();
    const completion = await aiClient.chat.completions.create({
      model: aiModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.9,
    });

    const roast = completion.choices[0]?.message?.content?.trim() ?? "The AI was too embarrassed to respond.";

    res.json({
      roast,
      stats: {
        totalRepos: summary.totalRepos,
        totalStars: summary.totalStars,
        mostUsedLanguage: summary.mostUsedLanguage,
        totalForks: summary.totalForks,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "USER_NOT_FOUND") {
      res.status(404).json({ error: `GitHub user "${cleanUsername}" not found.` });
    } else if (message.startsWith("GITHUB_API_ERROR")) {
      res.status(502).json({ error: "Could not reach the GitHub API. Try again later." });
    } else if (message.includes("GROQ_API_KEY") || message.includes("groq") || message.includes("401") || message.includes("403")) {
      console.error("AI error:", message);
      res.status(502).json({ error: "AI API key is missing or invalid. Check GROQ_API_KEY in your .env file." });
    } else {
      console.error("Unexpected error:", message);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  }
});

// Serve index.html for all other routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  const provider = process.env.GROQ_API_KEY ? "Groq (llama-3.3-70b-versatile)" : "NONE (set GROQ_API_KEY in .env)";
  console.log(`Roast My GitHub running at http://localhost:${PORT}`);
  console.log(`AI provider: ${provider}`);
});
