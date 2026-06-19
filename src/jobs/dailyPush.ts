import { Bot, InlineKeyboard } from "grammy";
import { prisma } from "../db/prisma.js";
import { generateContentPack } from "../ai/contentPack.js";

const freeLimit = 3;
const checkIntervalMs = 60 * 1000;
const autoPushMarker = "[auto_daily_push]";

let isRunning = false;

function getUtcDayRange(date: Date) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0)
  );

  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0)
  );

  return { start, end };
}

function isNewUtcDay(lastResetDate: Date) {
  const now = new Date();
  const lastReset = new Date(lastResetDate);

  return (
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate()
  );
}

function contentPackKeyboard() {
  return new InlineKeyboard()
    .text("More hooks", "action:more_hooks")
    .text("Make it viral", "action:make_viral")
    .row()
    .text("Rewrite for X", "action:rewrite_x")
    .text("Save idea", "action:save_idea");
}

async function runDailyPushTick(bot: Bot) {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const now = new Date();
    const currentUtcHour = now.getUTCHours();
    const { start, end } = getUtcDayRange(now);

    const users = await prisma.user.findMany({
      where: {
        state: "ACTIVE",
        pushHour: currentUtcHour,
        platform: {
          not: null,
        },
        niche: {
          not: null,
        },
        style: {
          not: null,
        },
      },
    });

    if (users.length === 0) {
      return;
    }

    console.log(`Daily push check: ${users.length} user(s) for UTC hour ${currentUtcHour}`);

    for (const user of users) {
      const existingAutoPush = await prisma.contentPack.findFirst({
        where: {
          userId: user.id,
          createdAt: {
            gte: start,
            lt: end,
          },
          prompt: {
            startsWith: autoPushMarker,
          },
        },
      });

      if (existingAutoPush) {
        continue;
      }

      let activeUser = user;

      if (isNewUtcDay(activeUser.lastResetDate)) {
        activeUser = await prisma.user.update({
          where: {
            id: activeUser.id,
          },
          data: {
            dailyGenerations: 0,
            lastResetDate: new Date(),
          },
        });
      }

      if (activeUser.tier === "FREE" && activeUser.dailyGenerations >= freeLimit) {
        console.log(`Skipping auto push for user ${activeUser.id}: free limit reached`);
        continue;
      }

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
            prompt: `${autoPushMarker}\n${result.prompt}`,
          },
        });

        await prisma.user.update({
          where: {
            id: activeUser.id,
          },
          data: {
            dailyGenerations: {
              increment: 1,
            },
          },
        });

        await bot.api.sendMessage(
          activeUser.telegramId.toString(),
          ["Your daily crypto content pack", "", result.content].join("\n"),
          {
            reply_markup: contentPackKeyboard(),
          }
        );

        console.log(`Auto daily push sent to user ${activeUser.id}`);
      } catch (error) {
        console.error(`Auto daily push failed for user ${activeUser.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Daily push job failed:", error);
  } finally {
    isRunning = false;
  }
}

export function startDailyPushJob(bot: Bot) {
  console.log("Daily push job started. Checking every 60 seconds.");

  setTimeout(() => {
    void runDailyPushTick(bot);
  }, 3000);

  setInterval(() => {
    void runDailyPushTick(bot);
  }, checkIntervalMs);
}
