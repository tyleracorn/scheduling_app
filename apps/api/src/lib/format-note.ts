import { toDateString } from "./dates.js";
import { DEFAULT_CATEGORY_COLOR } from "./note-category.js";

type NoteRow = {
  id: string;
  householdId: string;
  startDate: Date;
  endDate: Date;
  body: string;
  categoryId: string | null;
  createdByUserId: string;
  household: { name: string };
  category: { id: string; name: string; slug: string; color: string } | null;
  createdBy: { id: string; displayName: string };
};

export function formatCalendarNote(note: NoteRow) {
  return {
    id: note.id,
    household_id: note.householdId,
    household_name: note.household.name,
    start_date: toDateString(note.startDate),
    end_date: toDateString(note.endDate),
    body: note.body,
    category_id: note.categoryId,
    category_name: note.category?.name ?? "General",
    category_slug: note.category?.slug ?? "general",
    category_color: note.category?.color ?? DEFAULT_CATEGORY_COLOR,
    created_by_user_id: note.createdByUserId,
    created_by_name: note.createdBy.displayName,
  };
}

export const calendarNoteInclude = {
  household: true,
  category: true,
  createdBy: { select: { id: true, displayName: true } },
} as const;
