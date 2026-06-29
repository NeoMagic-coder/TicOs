import OpenAI from "openai";

export async function generateImages(
  prompt: string,
  size: string,
  count: number,
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Array.from({ length: count }, (_, i) =>
      `https://placehold.co/${size.replace("x", "x")}/7C3AED/FFFFFF/png?text=Image+${i + 1}`,
    );
  }

  const openai = new OpenAI({ apiKey });
  const urls: string[] = [];

  for (let i = 0; i < count; i++) {
    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: size as "1024x1024" | "1024x1792" | "1792x1024",
    });
    const url = result.data?.[0]?.url;
    if (url) urls.push(url);
  }

  return urls;
}
