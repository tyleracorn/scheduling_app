import nodemailer from "nodemailer";
import { config } from "../lib/config.js";

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

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    console.info("[email:dev]", { to, subject, text });
    return;
  }
  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
  });
}

export function inviteLink(token: string): string {
  return `${config.appUrl}/accept-invite?token=${encodeURIComponent(token)}`;
}

export function resetPasswordLink(token: string): string {
  return `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
}
