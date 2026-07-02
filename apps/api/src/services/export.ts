import fs from "node:fs/promises";
import path from "node:path";
import { toDateString } from "../lib/dates.js";
import { formatHowAssigned } from "../lib/assignment-labels.js";
import { periodBoundsFromWeeks } from "../lib/period-weeks.js";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(cells: string[]): string {
  return cells.map(csvEscape).join(",");
}

export async function buildPeriodExportCsv(periodId: string): Promise<string> {
  const period = await prisma.schedulingPeriod.findUnique({
    where: { id: periodId },
    include: {
      weeks: {
        orderBy: { sortOrder: "asc" },
        include: {
          assignment: { include: { household: true } },
        },
      },
    },
  });
  if (!period) return "";

  const notes = await prisma.calendarNote.findMany({
    where: {
      startDate: { lte: period.endDate },
      endDate: { gte: period.startDate },
    },
    include: { household: true, category: true },
    orderBy: { startDate: "asc" },
  });

  const redSharing = await prisma.occupancyIndicator.findMany({
    where: {
      status: "red",
      startDate: { lte: period.endDate },
      endDate: { gte: period.startDate },
    },
    include: { household: true },
    orderBy: [{ household: { name: "asc" } }, { startDate: "asc" }],
  });

  const bounds = periodBoundsFromWeeks(
    period.weeks.map((w) => ({
      weekStartDate: w.weekStartDate,
      weekEndDate: w.weekEndDate,
      sortOrder: w.sortOrder,
    })),
  );
  const periodStart = bounds?.startDate ?? period.startDate;
  const periodEnd = bounds?.endDate ?? period.endDate;

  const lines: string[] = [];
  lines.push("# Period");
  lines.push(csvRow(["name", "start_date", "end_date", "status"]));
  lines.push(
    csvRow([period.name, toDateString(periodStart), toDateString(periodEnd), period.status]),
  );
  lines.push("");
  lines.push("# Assignments");
  lines.push(csvRow(["week_start", "week_end", "household", "how_assigned"]));
  for (const w of period.weeks) {
    lines.push(
      csvRow([
        toDateString(w.weekStartDate),
        toDateString(w.weekEndDate),
        w.assignment?.household.name ?? "",
        formatHowAssigned(w.assignment?.source),
      ]),
    );
  }
  lines.push("");
  lines.push("# Notes");
  lines.push(csvRow(["household", "category", "start_date", "end_date", "body"]));
  for (const n of notes) {
    lines.push(
      csvRow([
        n.household.name,
        n.category?.name ?? "General",
        toDateString(n.startDate),
        toDateString(n.endDate),
        n.body,
      ]),
    );
  }
  lines.push("");
  lines.push("# Sharing (red only)");
  lines.push("# Default: all days are green unless listed below. None/not set is omitted.");
  lines.push(csvRow(["household", "start_date", "end_date", "status"]));
  for (const o of redSharing) {
    lines.push(
      csvRow([
        o.household.name,
        toDateString(o.startDate),
        toDateString(o.endDate),
        o.status,
      ]),
    );
  }

  const swapEvents = await prisma.auditEvent.findMany({
    where: {
      eventType: "weeks_swapped",
      entityType: "scheduling_period",
      entityId: periodId,
    },
    include: { actor: { select: { displayName: true } } },
    orderBy: { createdAt: "asc" },
  });

  lines.push("");
  lines.push("# Swap history");
  lines.push(
    csvRow([
      "swapped_at",
      "actor",
      "week_a_start",
      "week_a_household",
      "week_b_start",
      "week_b_household",
      "reason",
    ]),
  );
  for (const e of swapEvents) {
    const after = e.after as {
      week_a?: string;
      week_b?: string;
      household_a?: string;
      household_b?: string;
      actor_display_name?: string;
    } | null;
    lines.push(
      csvRow([
        e.createdAt.toISOString(),
        after?.actor_display_name ?? e.actor.displayName,
        after?.week_a ?? "",
        after?.household_a ?? "",
        after?.week_b ?? "",
        after?.household_b ?? "",
        e.reason ?? "",
      ]),
    );
  }

  return lines.join("\n");
}

export async function writePeriodExportToPath(periodId: string, label: string): Promise<string | null> {
  if (!config.exportPath) return null;
  const csv = await buildPeriodExportCsv(periodId);
  if (!csv) return null;

  const period = await prisma.schedulingPeriod.findUnique({ where: { id: periodId } });
  const safeName = (period?.name ?? periodId).replace(/[^\w.-]+/g, "_").slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${label}_${safeName}_${stamp}.csv`;
  const dir = config.exportPath;
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, csv, "utf8");
  return filePath;
}

let lastWeeklyExportKey = "";

export async function runWeeklyExportsIfDue() {
  if (!config.exportPath) return;
  const now = new Date();
  if (now.getUTCDay() !== 0) return;
  const weekKey = now.toISOString().slice(0, 10);
  if (lastWeeklyExportKey === weekKey) return;
  if (now.getUTCHours() < 2) return;
  lastWeeklyExportKey = weekKey;

  const periods = await prisma.schedulingPeriod.findMany({
    where: { status: { in: ["open", "draft", "assignment", "published"] } },
    orderBy: { startDate: "asc" },
  });
  for (const p of periods) {
    await writePeriodExportToPath(p.id, "weekly");
  }
}
