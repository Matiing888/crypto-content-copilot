const fs = require("fs");

const filePath = "src/bot/bot.ts";
let code = fs.readFileSync(filePath, "utf8");

const oldText = `[
      \`gm \${user.firstName ?? "creator"}\`,
      "",
      "I am your AI content co-pilot for crypto and finance creators.",
      "",
      "I will help you generate daily content packs with:",
      "- hooks",
      "- short-form ideas",
      "- scripts",
      "- X posts",
      "- CTAs",
      "",
      "First question: what is your main platform?",
    ].join("\\n")`;

const newText = `[
      \`gm \${user.firstName ?? "creator"}\`,
      "",
      "Welcome to Crypto Content Copilot.",
      "",
      "Get daily content ideas for crypto and finance creators:",
      "- scroll-stopping hooks",
      "- short-form video ideas",
      "- 30-60 second scripts",
      "- X posts and threads",
      "- viral angles",
      "- daily automatic content push",
      "",
      "No financial advice.",
      "No buy/sell signals.",
      "No leverage calls.",
      "",
      "Just creator content you can publish faster.",
      "",
      "First question: what is your main platform?",
    ].join("\\n")`;

if (!code.includes(oldText)) {
  console.error("Could not find the old /start text block.");
  process.exit(1);
}

code = code.replace(oldText, newText);

fs.writeFileSync(filePath, code, "utf8");

console.log("/start text updated");
