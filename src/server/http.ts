import express from "express";
import type Stripe from "stripe";
import type { Bot } from "grammy";
import { env } from "../env.js";
import { prisma } from "../db/prisma.js";
import { stripe } from "../billing/stripe.js";

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const currentPeriodEnd = (subscription as any).current_period_end;

  if (!currentPeriodEnd || typeof currentPeriodEnd !== "number") {
    return null;
  }

  return new Date(currentPeriodEnd * 1000);
}

function isProStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

async function activateUserFromCheckoutSession(session: Stripe.Checkout.Session, bot: Bot) {
  if (session.mode !== "subscription") {
    return;
  }

  const userId = session.metadata?.userId;
  const telegramId = session.metadata?.telegramId;

  if (!userId) {
    console.warn("Stripe checkout.session.completed missing userId metadata.");
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  let subscriptionStatus: string | null = null;
  let periodEnd: Date | null = null;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    subscriptionStatus = subscription.status;
    periodEnd = getSubscriptionPeriodEnd(subscription);
  }

  const tier = isProStatus(subscriptionStatus) ? "PRO" : "FREE";

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      tier,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus,
      subscriptionCurrentPeriodEnd: periodEnd,
    },
  });

  if (telegramId && tier === "PRO") {
    try {
      await bot.api.sendMessage(
        Number(telegramId),
        [
          "Your Crypto Content Copilot PRO subscription is active.",
          "",
          "You now have PRO access.",
          "",
          "Use /plan to check your plan.",
        ].join("\n")
      );
    } catch (error) {
      console.error("Failed to notify Telegram user after checkout:", error);
    }
  }
}

async function updateUserFromSubscription(subscription: Stripe.Subscription, bot: Bot) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const status = subscription.status;
  const tier = isProStatus(status) ? "PRO" : "FREE";
  const periodEnd = getSubscriptionPeriodEnd(subscription);

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        {
          stripeSubscriptionId: subscription.id,
        },
        {
          stripeCustomerId: customerId,
        },
      ],
    },
  });

  if (!user) {
    console.warn("No user found for Stripe subscription:", subscription.id);
    return;
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      tier,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      subscriptionCurrentPeriodEnd: periodEnd,
    },
  });

  if (tier === "FREE" && user.tier !== "FREE") {
    try {
      await bot.api.sendMessage(
        Number(user.telegramId),
        [
          "Your Crypto Content Copilot PRO subscription is no longer active.",
          "",
          "Your account has been moved back to FREE.",
          "",
          "Use /upgrade if you want to reactivate PRO.",
        ].join("\n")
      );
    } catch (error) {
      console.error("Failed to notify Telegram user after subscription update:", error);
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, bot: Bot) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;

  if (!customerId) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      stripeCustomerId: customerId,
    },
  });

  if (!user) {
    return;
  }

  try {
    await bot.api.sendMessage(
      Number(user.telegramId),
      [
        "Stripe could not process your latest PRO payment.",
        "",
        "Please use /billing to update your payment method.",
      ].join("\n")
    );
  } catch (error) {
    console.error("Failed to notify Telegram user after failed invoice:", error);
  }
}

export function startHttpServer(bot: Bot) {
  const app = express();

  app.get("/health", (_req, res) => {
    res.status(200).send("OK");
  });

  app.get("/billing/success", (_req, res) => {
    res.status(200).send("Payment successful. You can return to Telegram.");
  });

  app.get("/billing/cancel", (_req, res) => {
    res.status(200).send("Payment cancelled. You can return to Telegram.");
  });

  app.get("/billing/return", (_req, res) => {
    res.status(200).send("Billing portal closed. You can return to Telegram.");
  });

  app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    if (!env.stripeWebhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set.");
      res.status(500).send("Webhook secret not configured.");
      return;
    }

    const signature = req.header("stripe-signature");

    if (!signature) {
      res.status(400).send("Missing Stripe signature.");
      return;
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
    } catch (error) {
      console.error("Stripe webhook signature verification failed:", error);
      res.status(400).send("Invalid webhook signature.");
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await activateUserFromCheckoutSession(event.data.object as Stripe.Checkout.Session, bot);
          break;

        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await updateUserFromSubscription(event.data.object as Stripe.Subscription, bot);
          break;

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, bot);
          break;

        default:
          console.log(`Unhandled Stripe event: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Stripe webhook handler failed:", error);
      res.status(500).send("Webhook handler failed.");
    }
  });

  app.listen(env.port, () => {
    console.log(`HTTP server listening on port ${env.port}`);
  });
}