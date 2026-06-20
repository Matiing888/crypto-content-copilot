import { Bot, InlineKeyboard } from "grammy";
import { env } from "../env.js";
import { prisma } from "../db/prisma.js";
import { stripe } from "../billing/stripe.js";
import { generateContentPack, generateMoreHooks, rewriteForX, makeItViral } from "../ai/contentPack.js";

export const bot = new Bot(env.botToken);

const freeLimit = 3;

async function getUserByTelegramId(telegramId: number) {
  return prisma.user.findUnique({
    where: {
      telegramId: BigInt(telegramId),
    },
  });
}

type AppUser = NonNullable<Awaited<ReturnType<typeof getUserByTelegramId>>>;

function isNewUtcDay(lastResetDate: Date) {
  const now = new Date();
  const lastReset = new Date(lastResetDate);

  return (
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate()
  );
}

async function resetDailyLimitIfNeeded(user: AppUser | null): Promise<AppUser | null> {
  if (!user) return null;

  if (!isNewUtcDay(user.lastResetDate)) {
    return user;
  }

  return prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      dailyGenerations: 0,
      lastResetDate: new Date(),
    },
  });
}

async function checkLimit(
  user: AppUser | null
): Promise<
  | { allowed: false; message: string }
  | { allowed: true; user: AppUser }
> {
  if (!user) {
    return {
      allowed: false,
      message: "Please start first with /start.",
    };
  }

  const freshUser = await resetDailyLimitIfNeeded(user);

  if (!freshUser) {
    return {
      allowed: false,
      message: "Please start first with /start.",
    };
  }

  if (freshUser.tier === "FREE" && freshUser.dailyGenerations >= freeLimit) {
    return {
      allowed: false,
      message: [
        "You have reached your free daily limit.",
        "",
        "Free plan: 3 AI actions per day.",
        "Pro plan will unlock more generations.",
      ].join("\n"),
    };
  }

  return {
    allowed: true,
    user: freshUser,
  };
}

async function incrementDailyGenerations(userId: string) {
  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      dailyGenerations: {
        increment: 1,
      },
    },
  });
}

function contentPackKeyboard() {
  return new InlineKeyboard()
    .text("More hooks", "action:more_hooks")
    .text("Make it viral", "action:make_viral")
    .row()
    .text("Rewrite for X", "action:rewrite_x")
    .text("Save idea", "action:save_idea");
}

bot.command("start", async (ctx) => {
  const from = ctx.from;

  if (!from) {
    await ctx.reply("I could not read your Telegram profile. Please try again.");
    return;
  }

  const user = await prisma.user.upsert({
    where: {
      telegramId: BigInt(from.id),
    },
    update: {
      username: from.username ?? null,
      firstName: from.first_name ?? null,
    },
    create: {
      telegramId: BigInt(from.id),
      username: from.username ?? null,
      firstName: from.first_name ?? null,
      state: "ONBOARDING",
    },
  });

  const keyboard = new InlineKeyboard()
    .text("X", "platform:X")
    .text("TikTok", "platform:TIKTOK")
    .row()
    .text("Instagram Reels", "platform:INSTAGRAM_REELS")
    .row()
    .text("YouTube Shorts", "platform:YOUTUBE_SHORTS")
    .text("Multi", "platform:MULTI");

  await ctx.reply(
    [
      `gm ${user.firstName ?? "creator"}`,
      "",
      "Welcome to Crypto Content Copilot.",
      "",
      "Create daily crypto and finance content without starting from a blank page.",
      "",
      "This bot helps you generate:",
      "- content angles",
      "- scroll-stopping hooks",
      "- short-form video ideas",
      "- 30-60 second scripts",
      "- X posts and thread ideas",
      "- viral rewrites",
      "- daily content prompts",
      "",
      "Important:",
      "This is a content creation tool.",
      "It does not provide financial advice, buy/sell signals, leverage calls, or guaranteed outcomes.",
      "",
      "First step: choose your main platform.",
    ].join("\n"),
    {
      reply_markup: keyboard,
    }
  );
});

bot.callbackQuery(/^platform:/, async (ctx) => {
  const platform = ctx.callbackQuery.data.replace("platform:", "");

  if (!ctx.from) {
    await ctx.answerCallbackQuery("Missing Telegram profile.");
    return;
  }

  await prisma.user.update({
    where: {
      telegramId: BigInt(ctx.from.id),
    },
    data: {
      platform: platform as any,
    },
  });

  const keyboard = new InlineKeyboard()
    .text("Bitcoin", "niche:BITCOIN")
    .text("Crypto Trading", "niche:CRYPTO_TRADING")
    .row()
    .text("DeFi", "niche:DEFI")
    .text("Macro", "niche:MACRO")
    .row()
    .text("Stocks", "niche:STOCKS")
    .text("Personal Finance", "niche:PERSONAL_FINANCE")
    .row()
    .text("Other", "niche:OTHER");

  await ctx.answerCallbackQuery();
  await ctx.reply("Nice. What is your main niche?", {
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^niche:/, async (ctx) => {
  const niche = ctx.callbackQuery.data.replace("niche:", "");

  if (!ctx.from) {
    await ctx.answerCallbackQuery("Missing Telegram profile.");
    return;
  }

  await prisma.user.update({
    where: {
      telegramId: BigInt(ctx.from.id),
    },
    data: {
      niche: niche as any,
    },
  });

  const keyboard = new InlineKeyboard()
    .text("Educational", "style:EDUCATIONAL")
    .text("Contrarian", "style:CONTRARIAN")
    .row()
    .text("Storytelling", "style:STORYTELLING")
    .text("Data-driven", "style:DATA_DRIVEN")
    .row()
    .text("Meme / Viral", "style:MEME_VIRAL")
    .row()
    .text("Founder Brand", "style:FOUNDER_BRAND");

  await ctx.answerCallbackQuery();
  await ctx.reply("Good. What content style fits you best?", {
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^style:/, async (ctx) => {
  const style = ctx.callbackQuery.data.replace("style:", "");

  if (!ctx.from) {
    await ctx.answerCallbackQuery("Missing Telegram profile.");
    return;
  }

  await prisma.user.update({
    where: {
      telegramId: BigInt(ctx.from.id),
    },
    data: {
      style: style as any,
      state: "ACTIVE",
    },
  });

  await ctx.answerCallbackQuery();

  await ctx.reply(
    [
      "Perfect. Your creator profile is ready.",
      "",
      "Now send /today and I will generate your first crypto content pack.",
      "",
      "Later this will become an automatic daily push.",
    ].join("\n")
  );
});

bot.command("today", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile. Please try again.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.reply("Please start first with /start.");
    return;
  }

  if (!user.platform || !user.niche || !user.style) {
    await ctx.reply("Your onboarding is not complete yet. Please type /start.");
    return;
  }

  const limitCheck = await checkLimit(user);

  if (!limitCheck.allowed) {
    await ctx.reply(limitCheck.message);
    return;
  }

  const activeUser = limitCheck.user;

  await ctx.reply("Generating your content pack...");

  try {
    const result = await generateContentPack({
      platform: activeUser.platform!,
      niche: activeUser.niche!,
      style: activeUser.style!,
    });

    await prisma.contentPack.create({
      data: {
        userId: activeUser.id,
        content: result.content,
        model: result.model,
        prompt: result.prompt,
      },
    });

    await incrementDailyGenerations(activeUser.id);

    await ctx.reply(result.content, {
      reply_markup: contentPackKeyboard(),
    });
  } catch (error) {
    console.error("AI generation failed:", error);
    await ctx.reply("Sorry, I could not generate your content pack right now. Please try again in a moment.");
  }
});

bot.command("resetlimits", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;

  if (!adminTelegramId || String(ctx.from.id) !== adminTelegramId) {
    await ctx.reply("You are not allowed to use this command.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.reply("Please start first with /start.");
    return;
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      dailyGenerations: 0,
      lastResetDate: new Date(),
    },
  });

  await ctx.reply("Admin: daily generation limit has been reset for your user.");
});

bot.command("saved", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.reply("Please start first with /start.");
    return;
  }

  const savedPacks = await prisma.contentPack.findMany({
    where: {
      userId: user.id,
      saved: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  if (savedPacks.length === 0) {
    await ctx.reply(
      [
        "No saved content packs yet.",
        "",
        "Generate a pack with /today, then tap Save idea.",
      ].join("\n")
    );
    return;
  }

  const message = savedPacks
    .map((pack, index) => {
      const preview =
        pack.content.length > 700
          ? `${pack.content.slice(0, 700)}...`
          : pack.content;

      return [
        `${index + 1}. Saved content pack`,
        `Created: ${pack.createdAt.toISOString().slice(0, 10)}`,
        "",
        preview,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  await ctx.reply(["Your saved content packs", "", message].join("\n"));
});

bot.callbackQuery("action:more_hooks", async (ctx) => {
  if (!ctx.from) {
    await ctx.answerCallbackQuery("Missing Telegram profile.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Please start first with /start.");
    return;
  }

  if (!user.platform || !user.niche || !user.style) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Your onboarding is not complete yet. Please type /start.");
    return;
  }

  const latestPack = await prisma.contentPack.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!latestPack) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Generate your first content pack with /today first.");
    return;
  }

  const limitCheck = await checkLimit(user);

  if (!limitCheck.allowed) {
    await ctx.answerCallbackQuery();
    await ctx.reply(limitCheck.message);
    return;
  }

  const activeUser = limitCheck.user;

  await ctx.answerCallbackQuery("Generating more hooks...");
  await ctx.reply("Generating 10 more hooks...");

  try {
    const hooks = await generateMoreHooks({
      platform: activeUser.platform!,
      niche: activeUser.niche!,
      style: activeUser.style!,
      previousContentPack: latestPack.content,
    });

    await incrementDailyGenerations(activeUser.id);

    await ctx.reply(["10 additional hooks", "", hooks].join("\n"));
  } catch (error) {
    console.error("More hooks generation failed:", error);
    await ctx.reply("Sorry, I could not generate more hooks right now. Please try again in a moment.");
  }
});

bot.callbackQuery("action:rewrite_x", async (ctx) => {
  if (!ctx.from) {
    await ctx.answerCallbackQuery("Missing Telegram profile.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Please start first with /start.");
    return;
  }

  if (!user.platform || !user.niche || !user.style) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Your onboarding is not complete yet. Please type /start.");
    return;
  }

  const latestPack = await prisma.contentPack.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!latestPack) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Generate your first content pack with /today first.");
    return;
  }

  const limitCheck = await checkLimit(user);

  if (!limitCheck.allowed) {
    await ctx.answerCallbackQuery();
    await ctx.reply(limitCheck.message);
    return;
  }

  const activeUser = limitCheck.user;

  await ctx.answerCallbackQuery("Rewriting for X...");
  await ctx.reply("Rewriting your latest content pack for X...");

  try {
    const xRewrite = await rewriteForX({
      platform: activeUser.platform!,
      niche: activeUser.niche!,
      style: activeUser.style!,
      previousContentPack: latestPack.content,
    });

    await incrementDailyGenerations(activeUser.id);

    await ctx.reply(xRewrite);
  } catch (error) {
    console.error("Rewrite for X failed:", error);
    await ctx.reply("Sorry, I could not rewrite this for X right now. Please try again in a moment.");
  }
});

bot.callbackQuery("action:make_viral", async (ctx) => {
  if (!ctx.from) {
    await ctx.answerCallbackQuery("Missing Telegram profile.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Please start first with /start.");
    return;
  }

  if (!user.platform || !user.niche || !user.style) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Your onboarding is not complete yet. Please type /start.");
    return;
  }

  const latestPack = await prisma.contentPack.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!latestPack) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Generate your first content pack with /today first.");
    return;
  }

  const limitCheck = await checkLimit(user);

  if (!limitCheck.allowed) {
    await ctx.answerCallbackQuery();
    await ctx.reply(limitCheck.message);
    return;
  }

  const activeUser = limitCheck.user;

  await ctx.answerCallbackQuery("Making it viral...");
  await ctx.reply("Making your latest content pack more viral...");

  try {
    const viralVersion = await makeItViral({
      platform: activeUser.platform!,
      niche: activeUser.niche!,
      style: activeUser.style!,
      previousContentPack: latestPack.content,
    });

    await incrementDailyGenerations(activeUser.id);

    await ctx.reply(viralVersion);
  } catch (error) {
    console.error("Make it viral failed:", error);
    await ctx.reply("Sorry, I could not make this more viral right now. Please try again in a moment.");
  }
});

bot.callbackQuery("action:save_idea", async (ctx) => {
  if (!ctx.from) {
    await ctx.answerCallbackQuery("Missing Telegram profile.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Please start first with /start.");
    return;
  }

  const latestPack = await prisma.contentPack.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!latestPack) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Generate your first content pack with /today first.");
    return;
  }

  await prisma.contentPack.update({
    where: {
      id: latestPack.id,
    },
    data: {
      saved: true,
    },
  });

  await ctx.answerCallbackQuery("Saved.");
  await ctx.reply("Saved this content pack.");
});

bot.command("profile", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.reply("Please start first with /start.");
    return;
  }

  await ctx.reply(
    [
      "Your creator profile",
      "",
      `Platform: ${user.platform ?? "not set"}`,
      `Niche: ${user.niche ?? "not set"}`,
      `Style: ${user.style ?? "not set"}`,
      `Language: ${user.outputLanguage}`,
      `Plan: ${user.tier}`,
      "",
      `AI actions today: ${user.dailyGenerations}/${user.tier === "FREE" ? freeLimit : "unlimited"}`,
      "",
      "Use /settings to update your creator profile.",
      "Use /plan to check your current plan.",
    ].join("\n")
  );
});

bot.command("settings", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.reply("Please start first with /start.");
    return;
  }

  const keyboard = new InlineKeyboard()
    .text("Change platform", "settings:platform")
    .row()
    .text("Change niche", "settings:niche")
    .row()
    .text("Change style", "settings:style")
    .row()
    .text("Show profile", "settings:profile");

  await ctx.reply(
    [
      "Creator settings",
      "",
      "Current profile:",
      `Platform: ${user.platform ?? "not set"}`,
      `Niche: ${user.niche ?? "not set"}`,
      `Style: ${user.style ?? "not set"}`,
      "",
      "Choose what you want to update:",
    ].join("\n"),
    {
      reply_markup: keyboard,
    }
  );
});

bot.callbackQuery("settings:profile", async (ctx) => {
  if (!ctx.from) {
    await ctx.answerCallbackQuery("Missing Telegram profile.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.answerCallbackQuery();
    await ctx.reply("Please start first with /start.");
    return;
  }

  await ctx.answerCallbackQuery();

  await ctx.reply(
    [
      "Your creator profile",
      "",
      `Platform: ${user.platform ?? "not set"}`,
      `Niche: ${user.niche ?? "not set"}`,
      `Style: ${user.style ?? "not set"}`,
      `Language: ${user.outputLanguage}`,
      `Plan: ${user.tier}`,
      "",
      `AI actions used today: ${user.dailyGenerations}/${user.tier === "FREE" ? freeLimit : "unlimited"}`,
    ].join("\n")
  );
});

bot.callbackQuery("settings:platform", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("X", "set_platform:X")
    .text("TikTok", "set_platform:TIKTOK")
    .row()
    .text("Instagram Reels", "set_platform:INSTAGRAM_REELS")
    .row()
    .text("YouTube Shorts", "set_platform:YOUTUBE_SHORTS")
    .text("Multi", "set_platform:MULTI");

  await ctx.answerCallbackQuery();
  await ctx.reply("Choose your new main platform:", {
    reply_markup: keyboard,
  });
});

bot.callbackQuery("settings:niche", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("Bitcoin", "set_niche:BITCOIN")
    .text("Crypto Trading", "set_niche:CRYPTO_TRADING")
    .row()
    .text("DeFi", "set_niche:DEFI")
    .text("Macro", "set_niche:MACRO")
    .row()
    .text("Stocks", "set_niche:STOCKS")
    .text("Personal Finance", "set_niche:PERSONAL_FINANCE")
    .row()
    .text("Other", "set_niche:OTHER");

  await ctx.answerCallbackQuery();
  await ctx.reply("Choose your new niche:", {
    reply_markup: keyboard,
  });
});

bot.callbackQuery("settings:style", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("Educational", "set_style:EDUCATIONAL")
    .text("Contrarian", "set_style:CONTRARIAN")
    .row()
    .text("Storytelling", "set_style:STORYTELLING")
    .text("Data-driven", "set_style:DATA_DRIVEN")
    .row()
    .text("Meme / Viral", "set_style:MEME_VIRAL")
    .row()
    .text("Founder Brand", "set_style:FOUNDER_BRAND");

  await ctx.answerCallbackQuery();
  await ctx.reply("Choose your new content style:", {
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^set_platform:/, async (ctx) => {
  if (!ctx.from) {
    await ctx.answerCallbackQuery("Missing Telegram profile.");
    return;
  }

  const platform = ctx.callbackQuery.data.replace("set_platform:", "");

  await prisma.user.update({
    where: {
      telegramId: BigInt(ctx.from.id),
    },
    data: {
      platform: platform as any,
      state: "ACTIVE",
    },
  });

  await ctx.answerCallbackQuery("Platform updated.");
  await ctx.reply(`Platform updated to: ${platform}`);
});

bot.callbackQuery(/^set_niche:/, async (ctx) => {
  if (!ctx.from) {
    await ctx.answerCallbackQuery("Missing Telegram profile.");
    return;
  }

  const niche = ctx.callbackQuery.data.replace("set_niche:", "");

  await prisma.user.update({
    where: {
      telegramId: BigInt(ctx.from.id),
    },
    data: {
      niche: niche as any,
      state: "ACTIVE",
    },
  });

  await ctx.answerCallbackQuery("Niche updated.");
  await ctx.reply(`Niche updated to: ${niche}`);
});

bot.callbackQuery(/^set_style:/, async (ctx) => {
  if (!ctx.from) {
    await ctx.answerCallbackQuery("Missing Telegram profile.");
    return;
  }

  const style = ctx.callbackQuery.data.replace("set_style:", "");

  await prisma.user.update({
    where: {
      telegramId: BigInt(ctx.from.id),
    },
    data: {
      style: style as any,
      state: "ACTIVE",
    },
  });

  await ctx.answerCallbackQuery("Style updated.");
  await ctx.reply(`Style updated to: ${style}`);
});

bot.command("pushhour", async (ctx) => {
  console.log("Received /pushhour command");

  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.reply("Please start first with /start.");
    return;
  }

  const text = ctx.message?.text ?? "";
  const rawHour = text.split(/\s+/)[1];

  if (!rawHour) {
    await ctx.reply(
      [
        "Set your daily content push hour",
        "",
        "Use:",
        "/pushhour 8",
        "",
        "This means the bot will send your daily content prompt at 08:00 UTC.",
        "",
        "Examples:",
        "/pushhour 7 - morning UTC",
        "/pushhour 12 - midday UTC",
        "/pushhour 18 - evening UTC",
        "",
        `Current push hour: ${user.pushHour}:00 UTC`,
      ].join("\n")
    );
    return;
  }

  const hour = Number(rawHour);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    await ctx.reply(
      [
        "Please send a valid UTC hour between 0 and 23.",
        "",
        "Example:",
        "/pushhour 8",
      ].join("\n")
    );
    return;
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      pushHour: hour,
    },
  });

  await ctx.reply(
    [
      `Daily push hour updated to ${hour}:00 UTC.`,
      "",
      "You can change it anytime with /pushhour.",
    ].join("\n")
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "Crypto Content Copilot - help",
      "",
      "Main commands:",
      "",
      "/start - setup your creator profile",
      "/today - generate today's content pack",
      "/saved - show your saved content packs",
      "/profile - show your creator profile",
      "/settings - change platform, niche or style",
      "/pushhour - set automatic daily push hour in UTC",
      "/plan - check your current FREE or PRO plan",
      "/upgrade - unlock Crypto Content Copilot PRO",
      "/billing - manage or cancel your subscription",
      "/examples - show an example content pack",
      "/feedback - send product feedback",
      "/help - show help and available commands",
      "",
      "Buttons after /today:",
      "",
      "More hooks - generate 10 additional hooks",
      "Rewrite for X - turn the pack into an X post and thread",
      "Make it viral - create a sharper viral version",
      "Save idea - save the latest content pack",
      "",
      "FREE plan:",
      "3 AI actions per day.",
      "",
      "PRO:",
      "More AI usage, daily content push, and more creator workflow features during MVP.",
      "",
      "Reminder:",
      "This bot creates educational crypto and finance content.",
      "It does not provide financial advice, buy/sell signals, leverage guidance, or guaranteed outcomes.",
    ].join("\n")
  );
});

bot.command("myid", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  await ctx.reply(
    [
      "Your Telegram ID:",
      "",
      String(ctx.from.id),
      "",
      "Use this as ADMIN_TELEGRAM_ID in your .env file if you want admin commands.",
    ].join("\n")
  );
});

bot.command("upgrade", async (ctx) => {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply("I could not identify your Telegram account. Please try again.");
    return;
  }

  let user = await getUserByTelegramId(telegramUser.id);

  if (!user) {
    await ctx.reply("Please start first with /start.");
    return;
  }

  if (user.tier === "PRO") {
    await ctx.reply(
      [
        "You are already on Crypto Content Copilot PRO.",
        "",
        "Your subscription is active.",
        "",
        "Use /plan to check your current plan.",
        "Use /billing to manage or cancel your subscription.",
      ].join("\n")
    );
    return;
  }

  let stripeCustomerId = user.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      metadata: {
        userId: user.id,
        telegramId: telegramUser.id.toString(),
      },
      name: telegramUser.first_name ?? undefined,
      description: `Telegram user ${telegramUser.id}`,
    });

    stripeCustomerId = customer.id;

    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        stripeCustomerId,
      },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [
      {
        price: env.stripeProPriceId,
        quantity: 1,
      },
    ],
    success_url: `${env.publicAppUrl}?checkout=success`,
    cancel_url: `${env.publicAppUrl}?checkout=cancel`,
    metadata: {
      userId: user.id,
      telegramId: telegramUser.id.toString(),
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        telegramId: telegramUser.id.toString(),
      },
    },
  });

  if (!session.url) {
    await ctx.reply("Stripe did not return a checkout link. Please try again later.");
    return;
  }

  const keyboard = new InlineKeyboard().url("Unlock PRO with Stripe", session.url);

  await ctx.reply(
    [
      "Unlock Crypto Content Copilot PRO",
      "",
      "Price: 9 EUR / month",
      "",
      "Create daily crypto and finance content without starting from a blank page.",
      "",
      "PRO gives you:",
      "- more AI usage during MVP",
      "- automatic daily content prompts",
      "- more saved ideas",
      "- more creator formats as the product grows",
      "- priority access to new features",
      "",
      "Tap the button below to open Stripe Checkout.",
      "",
      "After payment, PRO is activated automatically when Stripe confirms your subscription.",
    ].join("\n"),
    {
      reply_markup: keyboard,
    }
  );
});

bot.command("billing", async (ctx) => {
  const telegramUser = ctx.from;

  if (!telegramUser) {
    await ctx.reply("I could not identify your Telegram account. Please try again.");
    return;
  }

  const user = await getUserByTelegramId(telegramUser.id);

  if (!user) {
    await ctx.reply("Please start first with /start.");
    return;
  }

  if (!user.stripeCustomerId) {
    await ctx.reply("No Stripe customer found yet. Use /upgrade first.");
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: env.publicAppUrl,
  });

  await ctx.reply(
    [
      "Manage your Crypto Content Copilot subscription:",
      "",
      session.url,
      "",
      "Inside Stripe you can:",
      "- update your payment method",
      "- view your subscription",
      "- cancel your PRO plan",
      "",
      "After cancellation, Stripe will send the update automatically.",
    ].join("\n")
  );
});

bot.command("plan", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  if (!user) {
    await ctx.reply("Please start first with /start.");
    return;
  }

  const dailyLimitText = user.tier === "FREE" ? `${freeLimit} AI actions/day` : "Unlimited AI actions/day for MVP testing";

  await ctx.reply(
    [
      `Your plan: ${user.tier}`,
      "",
      `Usage today: ${user.dailyGenerations}/${user.tier === "FREE" ? freeLimit : "unlimited"}`,
      `Current limit: ${dailyLimitText}`,
      "",
      user.tier === "PRO"
        ? "You have PRO access. Use /billing to manage or cancel your subscription."
        : "You are on the FREE plan. Use /upgrade to unlock PRO.",
      "",
      "FREE:",
      "- 3 AI actions per day",
      "- /today content pack",
      "- More hooks",
      "- Rewrite for X",
      "- Make it viral",
      "- Save idea",
      "",
      "PRO:",
      "- more AI usage during MVP",
      "- automatic daily content prompts",
      "- more saved ideas",
      "- more creator formats",
      "- priority access to new features",
    ].join("\n")
  );
});

bot.command("admin_pro", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;

  if (!adminTelegramId) {
    await ctx.reply(
      [
        "ADMIN_TELEGRAM_ID is not set.",
        "",
        "Step 1: type /myid",
        "Step 2: copy your Telegram ID",
        "Step 3: add this to .env:",
        "",
        'ADMIN_TELEGRAM_ID="your_id_here"',
        "",
        "Step 4: restart the bot",
      ].join("\n")
    );
    return;
  }

  if (String(ctx.from.id) !== adminTelegramId) {
    await ctx.reply("Command not available.");
    return;
  }

  const text = ctx.message?.text ?? "";
  const targetTelegramId = text.split(/\s+/)[1];

  if (!targetTelegramId) {
    await ctx.reply(
      [
        "Usage:",
        "/admin_pro 123456789",
        "",
        "This upgrades a Telegram user to PRO manually.",
      ].join("\n")
    );
    return;
  }

  const targetIdBigInt = BigInt(targetTelegramId);

  const targetUser = await prisma.user.findUnique({
    where: {
      telegramId: targetIdBigInt,
    },
  });

  if (!targetUser) {
    await ctx.reply("User not found. The user must start the bot first with /start.");
    return;
  }

  await prisma.user.update({
    where: {
      id: targetUser.id,
    },
    data: {
      tier: "PRO",
    },
  });

  await ctx.reply(`User ${targetTelegramId} upgraded to PRO.`);
});
bot.command("admin_free", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;

  if (!adminTelegramId) {
    await ctx.reply("ADMIN_TELEGRAM_ID is not set.");
    return;
  }

  if (String(ctx.from.id) !== adminTelegramId) {
    await ctx.reply("Command not available.");
    return;
  }

  const text = ctx.message?.text ?? "";
  const targetTelegramId = text.split(/\s+/)[1];

  if (!targetTelegramId) {
    await ctx.reply(
      [
        "Usage:",
        "/admin_free 123456789",
        "",
        "This downgrades a Telegram user to FREE and clears Stripe subscription data.",
      ].join("\n")
    );
    return;
  }

  const targetUser = await prisma.user.findUnique({
    where: {
      telegramId: BigInt(targetTelegramId),
    },
  });

  if (!targetUser) {
    await ctx.reply("User not found. The user must start the bot first with /start.");
    return;
  }

  await prisma.user.update({
    where: {
      id: targetUser.id,
    },
    data: {
      tier: "FREE",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
    },
  });

  await ctx.reply(`User ${targetTelegramId} downgraded to FREE and Stripe data cleared.`);
});
bot.command("status", async (ctx) => {
  const startedAtSecondsAgo = Math.floor(process.uptime());

  let dbStatus = "OK";
  let openAiStatus = "OK";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbStatus = "ERROR";
    console.error("Status check DB failed:", error);
  }

  try {
    const { openai } = await import("../ai/openai.js");
    await openai.models.list();
  } catch (error) {
    openAiStatus = "ERROR";
    console.error("Status check OpenAI failed:", error);
  }

  const stripeWebhookStatus = env.stripeWebhookSecret ? "configured" : "missing";

  await ctx.reply(
    [
      "System status",
      "",
      `Bot: OK`,
      `Database: ${dbStatus}`,
      `OpenAI: ${openAiStatus}`,
      `Stripe webhook: ${stripeWebhookStatus}`,
      `Environment: ${process.env.NODE_ENV ?? "development"}`,
      `Uptime: ${startedAtSecondsAgo} seconds`,
      "",
      dbStatus === "OK" && openAiStatus === "OK" && stripeWebhookStatus === "configured"
        ? "Everything looks healthy."
        : "One or more systems need attention. Check the VPS logs.",
    ].join("\n")
  );
});

bot.command("examples", async (ctx) => {
  await ctx.reply(
    [
      "Example content pack",
      "",
      "Niche: Bitcoin",
      "Style: Educational",
      "Platform: X",
      "",
      "1. Content angle",
      "Most people watch Bitcoin price. Better creators explain Bitcoin behavior.",
      "",
      "2. Hooks",
      "- Bitcoin is not hard to understand. It is hard to explain simply.",
      "- Most crypto content fails because it starts with price, not context.",
      "- The best Bitcoin creators do not predict. They translate.",
      "",
      "3. Short-form ideas",
      "- Explain Bitcoin using one simple analogy.",
      "- Break down why volatility creates attention but not trust.",
      "- Show how to turn market confusion into educational content.",
      "",
      "4. Script idea",
      "Most people think Bitcoin content has to predict the next move. It does not. The better angle is to explain what people are already feeling: confusion, fear, greed, or doubt.",
      "",
      "5. X post idea",
      "Crypto creators do not need more predictions. They need better explanations. Price gets attention. Clarity builds trust.",
      "",
      "Use /today to generate your own pack.",
    ].join("\n")
  );
});

bot.command("feedback", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  const text = ctx.message?.text ?? "";
  const feedback = text.replace(/^\/feedback(@\w+)?\s*/i, "").trim();

  if (!feedback) {
    await ctx.reply(
      [
        "Send feedback about Crypto Content Copilot",
        "",
        "Use:",
        "/feedback your message here",
        "",
        "Examples:",
        "/feedback I want better TikTok scripts",
        "/feedback Add more macro content angles",
        "/feedback The hooks are too generic",
      ].join("\n")
    );
    return;
  }

  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;

  if (!adminTelegramId) {
    console.log("Feedback received but ADMIN_TELEGRAM_ID is not set:", {
      from: ctx.from.id,
      username: ctx.from.username,
      feedback,
    });

    await ctx.reply("Thanks. Your feedback was received.");
    return;
  }

  const user = await getUserByTelegramId(ctx.from.id);

  await ctx.api.sendMessage(
    adminTelegramId,
    [
      "New feedback",
      "",
      `From Telegram ID: ${ctx.from.id}`,
      `Username: ${ctx.from.username ? "@" + ctx.from.username : "none"}`,
      `First name: ${ctx.from.first_name ?? "none"}`,
      "",
      user
        ? [
            "User profile:",
            `Plan: ${user.tier}`,
            `Platform: ${user.platform ?? "not set"}`,
            `Niche: ${user.niche ?? "not set"}`,
            `Style: ${user.style ?? "not set"}`,
          ].join("\n")
        : "User profile: not found in database",
      "",
      "Feedback:",
      feedback,
    ].join("\n")
  );

  await ctx.reply(
    [
      "Thanks. Your feedback was sent.",
      "",
      "This helps improve the MVP.",
    ].join("\n")
  );
});

bot.command("admin_stats", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;

  if (!adminTelegramId || String(ctx.from.id) !== adminTelegramId) {
    await ctx.reply("Command not available.");
    return;
  }

  const now = new Date();
  const startOfTodayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
  );

  const totalUsers = await prisma.user.count();
  const activeUsers = await prisma.user.count({
    where: {
      state: "ACTIVE",
    },
  });
  const freeUsers = await prisma.user.count({
    where: {
      tier: "FREE",
    },
  });
  const proUsers = await prisma.user.count({
    where: {
      tier: "PRO",
    },
  });
  const creatorUsers = await prisma.user.count({
    where: {
      tier: "CREATOR",
    },
  });
  const totalContentPacks = await prisma.contentPack.count();
  const savedContentPacks = await prisma.contentPack.count({
    where: {
      saved: true,
    },
  });
  const contentPacksToday = await prisma.contentPack.count({
    where: {
      createdAt: {
        gte: startOfTodayUtc,
      },
    },
  });
  const aiActionsTodayAggregate = await prisma.user.aggregate({
    where: {
      lastResetDate: {
        gte: startOfTodayUtc,
      },
    },
    _sum: {
      dailyGenerations: true,
    },
  });

  const aiActionsToday = aiActionsTodayAggregate._sum.dailyGenerations ?? 0;

  await ctx.reply(
    [
      "Admin stats",
      "",
      "Users:",
      `Total users: ${totalUsers}`,
      `Active users: ${activeUsers}`,
      `FREE users: ${freeUsers}`,
      `PRO users: ${proUsers}`,
      `CREATOR users: ${creatorUsers}`,
      "",
      "Content:",
      `Total content packs: ${totalContentPacks}`,
      `Saved content packs: ${savedContentPacks}`,
      `Content packs today UTC: ${contentPacksToday}`,
      "",
      "Usage:",
      `AI actions today UTC: ${aiActionsToday}`,
      "",
      `Checked at: ${now.toISOString()}`,
    ].join("\n")
  );
});

bot.command("admin_users", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("I could not read your Telegram profile.");
    return;
  }

  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;

  if (!adminTelegramId || String(ctx.from.id) !== adminTelegramId) {
    await ctx.reply("Command not available.");
    return;
  }

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  if (users.length === 0) {
    await ctx.reply("No users found.");
    return;
  }

  const message = users
    .map((user, index) => {
      return [
        `${index + 1}. User`,
        `Telegram ID: ${user.telegramId.toString()}`,
        `Username: ${user.username ? "@" + user.username : "none"}`,
        `First name: ${user.firstName ?? "none"}`,
        `State: ${user.state}`,
        `Tier: ${user.tier}`,
        `Platform: ${user.platform ?? "not set"}`,
        `Niche: ${user.niche ?? "not set"}`,
        `Style: ${user.style ?? "not set"}`,
        `AI actions today: ${user.dailyGenerations}`,
        `Created: ${user.createdAt.toISOString().slice(0, 10)}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  await ctx.reply(["Admin users", "", message].join("\n"));
});
