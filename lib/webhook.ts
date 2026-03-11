/**
 * Webhook notification system for monitoring alerts.
 * Sends POST requests to configured webhook URLs when high-risk events occur.
 */
import { getSettings } from "./settings";
import { logAudit } from "./audit-log";

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

    if (res.ok) {
      logAudit("webhook.sent", { event, url: webhookUrl, status: res.status });
      return true;
    } else {
      logAudit("webhook.failed", { event, url: webhookUrl, status: res.status });
      return false;
    }
  } catch (e) {
    logAudit("webhook.failed", {
      event,
      url: webhookUrl,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

/**
 * Check if a screening result should trigger a webhook alert.
 */
export function shouldAlert(riskLevel: string): boolean {
  const highRisk = ["Severe", "High"];
  return highRisk.includes(riskLevel);
}
