/**
 * Category Classifier
 *
 * Uses Claude AI (via CLI) to automatically classify articles into predefined categories.
 * The category is added as a text block at the top of the article.
 */

import { spawn } from "child_process";

/**
 * Predefined categories for article classification.
 * These are the 55 official categories for De Waarheidsvriend.
 */
export const PREDEFINED_CATEGORIES = [
  "Actualiteit",
  "Ambt",
  "Belijdenis",
  "Bijbelboek",
  "Bijbelvertaling",
  "Boekbespreking",
  "Column",
  "Diaconaat",
  "Doop",
  "Doop en Avondmaal",
  "Avondmaal",
  "Ethische thema's",
  "Geloof",
  "Geloofsleer",
  "Gezin",
  "Hervormd-Gereformeerd",
  "Huwelijk",
  "Interview",
  "Israel",
  "Jeugd",
  "Jongeren",
  "Kerk",
  "Kerkdienst",
  "Kerkgeschiedenis",
  "Kerkverband",
  "Kinderen",
  "Leerdienst",
  "Levenseinde",
  "Media",
  "Mediteren",
  "Meditatie",
  "Memoriam",
  "Missionair",
  "Muziek",
  "Onderwijs",
  "Opinie",
  "Overheid",
  "Pastoraat",
  "Pinksteren",
  "Prediking",
  "Prediker",
  "Psalmboek",
  "Reformatie",
  "Samenleving",
  "Spiritualiteit",
  "Toerusting",
  "Vakantie",
  "Verbond",
  "Verdieping",
  "Verkiezing",
  "Vrouwen",
  "Vrouwenwerk",
  "Werelddiaconaat",
  "Zending",
  "Zorg",
] as const;

export type CategoryName = (typeof PREDEFINED_CATEGORIES)[number];

/**
 * Claude CLI timeout in milliseconds (60 seconds)
 */
const CLAUDE_TIMEOUT_MS = 60000;

/**
 * Validate if a category is in the predefined list (case-insensitive match)
 */
export function validateCategory(category: string): CategoryName | null {
  const normalized = category.trim();
  const match = PREDEFINED_CATEGORIES.find(
    (c) => c.toLowerCase() === normalized.toLowerCase()
  );
  return match || null;
}

/**
 * Build the prompt for Claude to classify an article
 */
function buildClassificationPrompt(title: string, content: string): string {
  const categoriesList = PREDEFINED_CATEGORIES.join(", ");

  // Truncate content to avoid excessively long prompts (first ~2000 chars)
  const truncatedContent = content.length > 2000
    ? content.substring(0, 2000) + "..."
    : content;

  return `Analyseer dit artikel en kies exact één categorie uit de volgende lijst.
Antwoord ALLEEN met de categorienaam, zonder uitleg of extra tekst.

Categorieën: ${categoriesList}

Artikeltitel: ${title}

Artikelinhoud:
${truncatedContent}

Categorie:`;
}

/**
 * Run Claude CLI with stdin input and return stdout.
 * Uses spawn for better handling of long prompts.
 */
function runClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["--model", "haiku", "-p", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
      }
    });

    // Set timeout
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Claude CLI timeout after 60s"));
    }, CLAUDE_TIMEOUT_MS);

    child.on("close", () => {
      clearTimeout(timeout);
    });

    // Write prompt to stdin and close it
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * Classify an article using Claude CLI with Haiku model.
 *
 * @param title - Article title
 * @param content - Article content (plain text or HTML)
 * @returns The classified category name, or null if classification failed
 */
export async function classifyArticleWithClaude(
  title: string,
  content: string
): Promise<CategoryName | null> {
  const prompt = buildClassificationPrompt(title, content);

  try {
    const stdout = await runClaudeCli(prompt);
    const response = stdout.trim();

    // Validate the response is a known category
    const validCategory = validateCategory(response);

    if (!validCategory) {
      console.warn(
        `[CategoryClassifier] Claude returned invalid category: "${response}"`
      );
      return null;
    }

    return validCategory;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        console.warn("[CategoryClassifier] Claude CLI timeout");
      } else if (error.message.includes("ENOENT")) {
        console.error("[CategoryClassifier] Claude CLI not found. Is it installed?");
      } else {
        console.error(`[CategoryClassifier] Claude CLI error: ${error.message}`);
      }
    } else {
      console.error("[CategoryClassifier] Unknown error:", error);
    }

    return null;
  }
}

/**
 * Strip HTML tags from content for better classification
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Main orchestration function: classify an article and return the category name.
 *
 * Error handling: Returns null on any error, which allows publishing to continue
 * without a category (graceful degradation).
 *
 * @param title - Article title
 * @param content - Article content (HTML format from database)
 * @returns Category name if classification succeeded, null otherwise
 */
export async function classifyArticleCategory(
  title: string,
  content: string
): Promise<CategoryName | null> {
  // Strip HTML for cleaner classification
  const plainContent = stripHtml(content);

  // Skip very short content (likely not enough context)
  if (plainContent.length < 100) {
    console.warn("[CategoryClassifier] Article content too short for classification");
    return null;
  }

  return await classifyArticleWithClaude(title, plainContent);
}
