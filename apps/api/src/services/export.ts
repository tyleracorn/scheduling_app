import fs from "node:fs/promises";
import path from "node:path";
import { toDateString } from "../lib/dates.js";
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

  const lines: string[] = [];
  lines.push("# Period");
  lines.push(csvRow(["name", "start_date", "end_date", "status"]));
  lines.push(
    csvRow([
      period.name,
      toDateString(period.startDate),
      toDateString(period.endDate),
      period.status,
    ]),
  );
  lines.push("");
  lines.push("# Assignments");
  lines.push(csvRow(["week_start", "week_end", "household", "source"]));
  for (const w of period.weeks) {
    lines.push(
      csvRow([
        toDateString(w.weekStartDate),
        toDateString(w.weekEndDate),
        w.assignment?.household.name ?? "",
        w.assignment?.source ?? "",
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
