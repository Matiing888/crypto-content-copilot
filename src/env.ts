import "dotenv/config";

const requiredEnvVars = [
  "DATABASE_URL",
  "BOT_TOKEN",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRO_PRICE_ID",
  "PUBLIC_APP_URL",
] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  botToken: process.env.BOT_TOKEN!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeProPriceId: process.env.STRIPE_PRO_PRICE_ID!,
  publicAppUrl: process.env.PUBLIC_APP_URL!,
  port: Number(process.env.PORT ?? "3000"),
  nodeEnv: process.env.NODE_ENV ?? "development",
};