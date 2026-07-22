/**
 * Webhook notification system for monitoring alerts.
 * Sends POST requests to configured webhook URLs when high-risk events occur.
 */
import { getSettings } from "./settings";

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export async function sendWebhook(event: string, data: Record<string, unknown>): Promise<boolean> {
  const settings = getSettings();
  if (!settings.notifications.webhookEnabled || !settings.notifications.webhookUrl) return false;
  const webhookUrl = settings.notifications.webhookUrl;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Check if a screening result should trigger a webhook alert.
 * Risk vocabulary (v3): low | medium | high | critical
 */
export function shouldAlert(riskLevel: string): boolean {
  const highRisk = ["critical", "high"];
  return highRisk.includes(String(riskLevel).toLowerCase());
}
