import { openai } from "./openai.js";

type GenerateContentPackInput = {
  platform: string;
  niche: string;
  style: string;
};

type GenerateContentPackResult = {
  content: string;
  prompt: string;
  model: string;
};

type GenerateMoreHooksInput = {
  platform: string;
  niche: string;
  style: string;
  previousContentPack: string;
};

type RewriteForXInput = {
  platform: string;
  niche: string;
  style: string;
  previousContentPack: string;
};

type MakeItViralInput = {
  platform: string;
  niche: string;
  style: string;
  previousContentPack: string;
};

const defaultModel = "gpt-4.1-mini";

export async function generateContentPack(input: GenerateContentPackInput): Promise<GenerateContentPackResult> {
  const model = defaultModel;

  const prompt = [
    "You are an AI content co-pilot for crypto and finance creators.",
    "",
    "Create a daily content pack for this creator.",
    "",
    `Platform: ${input.platform}`,
    `Niche: ${input.niche}`,
    `Style: ${input.style}`,
    "",
    "Rules:",
    "- Write in English.",
    "- Do not give financial advice.",
    "- Do not create buy/sell signals.",
    "- Do not mention specific leverage or trade entries.",
    "- Focus on education, creator positioning, content ideas, and audience growth.",
    "- Keep it practical and ready to publish.",
    "- Avoid generic advice. Make the ideas sharp and specific.",
    "- Do not use hashtags unless explicitly useful.",
    "",
    "Return the answer in this exact structure:",
    "",
    "Your crypto content pack for today",
    "",
    "1. Market/content angle of the day",
    "[one useful angle]",
    "",
    "2. 5 hooks",
    "- hook 1",
    "- hook 2",
    "- hook 3",
    "- hook 4",
    "- hook 5",
    "",
    "3. 3 short-form ideas",
    "- idea 1",
    "- idea 2",
    "- idea 3",
    "",
    "4. Script",
    "[one 30-60 second short-form video script]",
    "",
    "5. X post",
    "[one concise X post]",
    "",
    "6. CTA",
    "[one simple CTA]",
  ].join("\n");

  const response = await openai.responses.create({
    model,
    input: prompt,
  });

  return {
    content: response.output_text,
    prompt,
    model,
  };
}

export async function generateMoreHooks(input: GenerateMoreHooksInput): Promise<string> {
  const response = await openai.responses.create({
    model: defaultModel,
    input: [
      "You are an AI content co-pilot for crypto and finance creators.",
      "",
      "Generate 10 additional hooks based on the user's latest content pack.",
      "",
      `Platform: ${input.platform}`,
      `Niche: ${input.niche}`,
      `Style: ${input.style}`,
      "",
      "Previous content pack:",
      input.previousContentPack,
      "",
      "Rules:",
      "- Write in English.",
      "- Do not give financial advice.",
      "- Do not create buy/sell signals.",
      "- Make hooks specific, sharp, and scroll-stopping.",
      "- Avoid generic motivational phrases.",
      "- Return only a numbered list of 10 hooks.",
    ].join("\n"),
  });

  return response.output_text;
}

export async function rewriteForX(input: RewriteForXInput): Promise<string> {
  const response = await openai.responses.create({
    model: defaultModel,
    input: [
      "You are an expert X/Twitter ghostwriter for crypto and finance creators.",
      "",
      "Rewrite the user's latest content pack into ready-to-publish X content.",
      "",
      `Platform: ${input.platform}`,
      `Niche: ${input.niche}`,
      `Style: ${input.style}`,
      "",
      "Previous content pack:",
      input.previousContentPack,
      "",
      "Rules:",
      "- Write in English.",
      "- Do not give financial advice.",
      "- Do not create buy/sell signals.",
      "- Do not mention exact entries, stop losses, leverage, or guaranteed outcomes.",
      "- Make it sharp, clear, and native to X.",
      "- Avoid generic AI phrasing.",
      "- Avoid hashtags unless they are truly useful.",
      "- Keep each post concise.",
      "",
      "Return exactly this structure:",
      "",
      "X rewrite",
      "",
      "Main post:",
      "[one standalone X post under 280 characters]",
      "",
      "Thread version:",
      "1/ [tweet 1]",
      "2/ [tweet 2]",
      "3/ [tweet 3]",
      "4/ [tweet 4]",
      "5/ [tweet 5]",
      "",
      "Alternative hooks:",
      "- hook 1",
      "- hook 2",
      "- hook 3",
    ].join("\n"),
  });

  return response.output_text;
}

export async function makeItViral(input: MakeItViralInput): Promise<string> {
  const response = await openai.responses.create({
    model: defaultModel,
    input: [
      "You are an expert viral content strategist for crypto and finance creators.",
      "",
      "Take the user's latest content pack and make it more viral, sharper, and more engaging.",
      "",
      `Platform: ${input.platform}`,
      `Niche: ${input.niche}`,
      `Style: ${input.style}`,
      "",
      "Previous content pack:",
      input.previousContentPack,
      "",
      "Rules:",
      "- Write in English.",
      "- Do not give financial advice.",
      "- Do not create buy/sell signals.",
      "- Do not use fake urgency, fake certainty, or guaranteed outcomes.",
      "- Do not make price predictions.",
      "- Make the content more specific, opinionated, and scroll-stopping.",
      "- Use clear tension, contrast, curiosity, and strong framing.",
      "- Avoid clickbait that damages trust.",
      "- Avoid generic AI phrasing.",
      "",
      "Return exactly this structure:",
      "",
      "Viral version",
      "",
      "Stronger angle:",
      "[one sharper angle]",
      "",
      "10 viral hooks:",
      "1. [hook]",
      "2. [hook]",
      "3. [hook]",
      "4. [hook]",
      "5. [hook]",
      "6. [hook]",
      "7. [hook]",
      "8. [hook]",
      "9. [hook]",
      "10. [hook]",
      "",
      "Short-form script:",
      "[one punchier 30-45 second script]",
      "",
      "Viral X post:",
      "[one concise X post]",
      "",
      "CTA:",
      "[one CTA designed for replies or saves]",
    ].join("\n"),
  });

  return response.output_text;
}
