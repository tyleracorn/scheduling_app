import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { CalendarNote } from "../lib/calendar-types";
import { monthRange } from "../lib/calendar-utils";
import { useAuth } from "../context/AuthContext";
import { NoteCard } from "../components/NoteCard";

type ScopeFilter = "all" | "mine";

function notesEndDate(): string {
  const year = new Date().getUTCFullYear() + 2;
  return `${year}-12-31`;
}

export function NotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [categories, setCategories] = useState<
    { id: string; name: string; slug: string; color: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [householdFilter, setHouseholdFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const probe = monthRange(today.getUTCFullYear(), today.getUTCMonth());
      const cal = await api.calendar(probe.start, probe.end);
      const res = await api.notes(cal.settings.notes_earliest_date, notesEndDate());
      setNotes(res.notes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .noteCategories()
      .then((r) => setCategories(r.categories))
      .catch(() => setCategories([]));
  }, []);

  const households = useMemo(() => {
    const names = new Map<string, string>();
    for (const note of notes) {
      names.set(note.household_id, note.household_name);
    }
    return [...names.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        if (scopeFilter === "mine" && user?.id !== note.created_by_user_id) return false;
        if (householdFilter && note.household_id !== householdFilter) return false;
        if (categoryFilter && note.category_id !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
  }, [notes, scopeFilter, householdFilter, categoryFilter, user?.id]);

  const activeFilterCount =
    (scopeFilter !== "all" ? 1 : 0) + (householdFilter ? 1 : 0) + (categoryFilter ? 1 : 0);

  function clearFilters() {
    setScopeFilter("all");
    setHouseholdFilter("");
    setCategoryFilter("");
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this note?")) return;
    setBusyId(id);
    setError(null);
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Household notes</h1>
          <p className="text-sm text-slate-600 mt-1">
            Notes from every household. You can delete notes you wrote.
          </p>
        </div>
        <Link
          to="/"
          className="text-sm text-slate-600 hover:text-slate-900 underline shrink-0"
        >
          Back to calendar
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setScopeFilter("all")}
          className={`rounded-full px-3 py-1 text-sm border ${
            scopeFilter === "all"
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
          }`}
        >
          All notes
        </button>
        <button
          type="button"
          onClick={() => setScopeFilter("mine")}
          disabled={!user}
          className={`rounded-full px-3 py-1 text-sm border ${
            scopeFilter === "mine"
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          }`}
        >
          My notes
        </button>
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          className={`rounded-full px-3 py-1 text-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 ${
            filtersOpen ? "ring-2 ring-slate-300" : ""
          }`}
          aria-expanded={filtersOpen}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-slate-500 hover:text-slate-800 underline"
          >
            Clear
          </button>
        )}
      </div>

      {filtersOpen && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-wrap gap-3">
          <label className="text-sm flex flex-col gap-1 min-w-[10rem]">
            <span className="text-xs font-medium text-slate-600">Household</span>
            <select
              value={householdFilter}
              onChange={(e) => setHouseholdFilter(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2 py-1.5"
            >
              <option value="">All households</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm flex flex-col gap-1 min-w-[10rem]">
            <span className="text-xs font-medium text-slate-600">Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2 py-1.5"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && (
        <p className="mb-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Loading notes…</p>
      ) : filteredNotes.length === 0 ? (
        <p className="text-slate-500 text-sm">
          {notes.length === 0
            ? "No notes yet. Add one from the calendar."
            : "No notes match these filters."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              currentUserId={user?.id ?? null}
              busy={busyId === note.id}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
