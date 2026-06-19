import "dotenv/config";

const requiredEnvVars = ["DATABASE_URL", "BOT_TOKEN", "OPENAI_API_KEY"] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  botToken: process.env.BOT_TOKEN!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
  nodeEnv: process.env.NODE_ENV ?? "development",
};
