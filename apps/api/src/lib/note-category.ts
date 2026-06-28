import { prisma } from "./prisma.js";

const DEFAULT_CATEGORY_COLOR = "#64748B";

export function slugFromName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "category";
}

export async function uniqueCategorySlug(name: string, excludeId?: string): Promise<string> {
  let slug = slugFromName(name);
  let suffix = 2;
  for (;;) {
    const existing = await prisma.noteCategory.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${slugFromName(name)}-${suffix++}`;
  }
}

export function formatNoteCategory(c: {
  id: string;
  name: string;
  slug: string;
  color: string;
  active: boolean;
  sortOrder: number;
}) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    color: c.color,
    active: c.active,
    sort_order: c.sortOrder,
  };
}

export { DEFAULT_CATEGORY_COLOR };
