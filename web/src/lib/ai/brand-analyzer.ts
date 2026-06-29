import OpenAI from "openai";
import type { VoiceProfile } from "@/types/database";

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

async function scrapeUrl(url: string): Promise<string> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;

  if (firecrawlKey) {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.data?.markdown ?? data.markdown ?? "";
    }
  }

  const pageRes = await fetch(url, {
    headers: { "User-Agent": "TicosclawBot/1.0" },
  });
  const html = await pageRes.text();
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 8000);
}

export async function analyzeBrandFromUrl(url: string): Promise<VoiceProfile> {
  const content = await scrapeUrl(url);
  const openai = getOpenAI();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert brand strategist. Analyze the website content and return a complete brand advisory profile as a single JSON object. All free-text values MUST be written in Turkish. Use these exact keys:
- tone (string[]): 3-5 voice tone descriptors
- personality (string[]): 3-5 brand personality traits
- wordPreferences ({preferred: string[], avoid: string[]})
- audience (string): short description of the target audience
- colors (string[]): brand colors as hex codes
- fonts (string[]): font families used
- summary (string): 2-3 sentence brand summary
- industry (string): the brand's industry/sector
- tagline (string): a short brand tagline
- positioning (string): 2-3 sentences describing market positioning
- valueProposition (string): 1-2 sentence core value proposition
- valuePropositionPoints (string[]): 3-5 concrete value/benefit bullet points
- targetSegment (string): 1-2 sentence description of the primary target segment
- segments (string[]): 2-4 distinct customer segments
- competitors (array of {name, description, strengths: string[], weaknesses: string[]}): 2-4 likely competitors
- personas (array of {name, role, description, goals: string[], painPoints: string[]}): 2-3 buyer personas
- digitalStrategy (array of {channel, recommendation}): 4-6 actionable digital marketing recommendations per channel (e.g. SEO, Instagram, E-posta, Google Ads).
Always populate every key. If information is missing from the page, infer reasonable values from the industry.`,
      },
      {
        role: "user",
        content: `Website URL: ${url}\n\nContent:\n${content}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as VoiceProfile;
}
