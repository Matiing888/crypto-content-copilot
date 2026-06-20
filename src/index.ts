import { bot } from "./bot/bot.js";
import { startDailyPushJob } from "./jobs/dailyPush.js";
import { startHttpServer } from "./server/http.js";

async function main() {
  console.log("Starting crypto content co-pilot bot...");

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  startHttpServer(bot);
  startDailyPushJob(bot);

  await bot.start();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});