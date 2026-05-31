import { useState } from "react";
import { Link } from "react-router-dom";
import {
  getOccupancyDefaultMode,
  setOccupancyDefaultMode,
  type OccupancyDefaultMode,
} from "../lib/preferences";

export function SettingsPage() {
  const [mode, setMode] = useState<OccupancyDefaultMode>(() => getOccupancyDefaultMode());
  const [saved, setSaved] = useState(false);

  function select(next: OccupancyDefaultMode) {
    setMode(next);
    setOccupancyDefaultMode(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-2">Settings</h1>
      <p className="text-sm text-slate-600 mb-6">
        Preferences are saved in this browser.{" "}
        <Link to="/" className="underline text-slate-800">
          Back to calendar
        </Link>
      </p>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-slate-800 mb-1">Occupancy default</h2>
        <p className="text-xs text-slate-500 mb-4">
          When you add a green/red occupancy range on the calendar, this controls whether a status
          is selected for you automatically.
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer rounded-md border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-green-400 has-[:checked]:bg-green-50/50">
            <input
              type="radio"
              name="occ-mode"
              className="mt-0.5"
              checked={mode === "green"}
              onChange={() => select("green")}
            />
            <span>
              <span className="font-medium text-slate-800">Green (default)</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                New occupancy ranges start as green — others are welcome.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer rounded-md border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-red-400 has-[:checked]:bg-red-50/50">
            <input
              type="radio"
              name="occ-mode"
              className="mt-0.5"
              checked={mode === "red"}
              onChange={() => select("red")}
            />
            <span>
              <span className="font-medium text-slate-800">Red (default)</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                New occupancy ranges start as red — prefer exclusive use.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer rounded-md border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-slate-400 has-[:checked]:bg-slate-50">
            <input
              type="radio"
              name="occ-mode"
              className="mt-0.5"
              checked={mode === "none"}
              onChange={() => select("none")}
            />
            <span>
              <span className="font-medium text-slate-800">Don&apos;t assign default</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                You choose green or red each time you add occupancy.
              </span>
            </span>
          </label>
        </div>

        {saved && <p className="text-sm text-green-700 mt-4">Saved.</p>}
      </section>
    </div>
  );
}
