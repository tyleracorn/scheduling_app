import nodemailer from "nodemailer";
import { config } from "../lib/config.js";

export type EmailDelivery = "smtp" | "dev_log" | "skipped";

function getTransport() {
  if (!config.smtp.host) return null;
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

export function getSmtpStatus() {
  const configured = Boolean(config.smtp.host);
  return {
    configured,
    mode: configured ? ("smtp" as const) : ("dev" as const),
    host: config.smtp.host || null,
    port: config.smtp.port,
    from: config.smtp.from,
    has_auth: Boolean(config.smtp.user),
  };
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<EmailDelivery> {
  const transport = getTransport();
  if (!transport) {
    if (config.isProduction) {
      console.warn("[email]", { to, subject, delivery: "skipped" });
      return "skipped";
    }
    console.info("[email:dev]", { to, subject, delivery: "dev_log", text });
    return "dev_log";
  }
  try {
    await transport.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text,
      html: html ?? text.replace(/\n/g, "<br>"),
    });
  } catch (err) {
    console.error("[email]", { to, subject, err });
    throw err;
  }
  console.info("[email]", { to, subject, delivery: "smtp" });
  return "smtp";
}

export function inviteLink(token: string): string {
  return `${config.appUrl}/accept-invite?token=${encodeURIComponent(token)}`;
}

export function resetPasswordLink(token: string): string {
  return `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
}
