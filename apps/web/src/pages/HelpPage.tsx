/*
 * Help screenshots live in apps/web/public/help/.
 * Refresh when labeled UI flows change:
 *   member-calendar.png
 *   member-notes-sharing.png
 *   member-confirm-week.png
 *   member-revise-pick.png
 *   member-swap.png
 *   member-settings.png
 *   coord-periods-setup.png
 *   coord-period-activity.png
 *   coord-hold.png
 *   coord-assign-publish.png
 *   coord-reassign.png
 *   coord-admin-setup.png
 */
import { Link } from "react-router-dom";
import { HelpSection } from "../components/HelpSection";
import { HelpToc } from "../components/HelpToc";

const tocGroups = [
  {
    heading: "Everyone",
    links: [
      { href: "#getting-started", label: "Getting started" },
      { href: "#read-the-calendar", label: "Read the calendar" },
      { href: "#notes-and-sharing", label: "Notes and green/red" },
      { href: "#my-turn-to-pick", label: "It’s my turn to pick" },
      { href: "#change-or-release-pick", label: "Change or release a pick" },
      { href: "#after-schedule-set", label: "After the schedule is set" },
      { href: "#settings", label: "Settings" },
    ],
  },
  {
    heading: "Coordinators",
    links: [
      { href: "#season-at-a-glance", label: "Season at a glance" },
      { href: "#set-up-a-period", label: "Set up a period" },
      { href: "#during-draft", label: "During draft" },
      { href: "#hold-and-stuck-turns", label: "Hold and stuck turns" },
      { href: "#assign-and-publish", label: "Assign and publish" },
      { href: "#after-publish", label: "After publish" },
      { href: "#first-time-admin-setup", label: "First-time admin setup" },
    ],
  },
];

export function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Help</h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Short how-tos for Cabin Schedule. Jump to the task you need — you do not have to read
          everything.
        </p>
        <p className="text-sm text-slate-600 mt-2">
          <Link to="/" className="underline text-slate-800">
            Back to calendar
          </Link>
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-8 lg:items-start">
        <HelpToc groups={tocGroups} />

        <div className="mt-6 lg:mt-0 space-y-10">
          <div id="everyone" className="scroll-mt-20 space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Everyone</h2>
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">Where are we in the season?</span>{" "}
                Periods move through: <strong>Open for notes</strong> →{" "}
                <strong>Pick your weeks</strong> → <strong>Assign remaining weeks</strong> →{" "}
                <strong>Schedule set</strong>. Sticky alerts at the top of the calendar point you to
                what needs attention.
              </p>
            </div>

            <HelpSection
              id="getting-started"
              title="Getting started"
              steps={[
                "Open the invite email and follow the link to set your password (Accept invite).",
                "Log in with your email and password. You’ll land on Calendar.",
                "Forgot your password? Use Forgot password on the login screen, then follow the reset email.",
              ]}
              tip="Your email and household assignment are set by an administrator — you can change your display name, password, household name, and calendar shortcode in Settings."
            />

            <HelpSection
              id="read-the-calendar"
              title="Read the calendar"
              steps={[
                "Open Calendar from the top nav. Use the month arrows to move around.",
                "Days show household colors when a week is assigned. Unassigned weeks look empty.",
                "Look for Wk▸ / ◂Wk markers — those mark scheduling week boundaries (week start day from the period plan).",
                "Click any day to open the day drawer: assignment, notes, and sharing for that week.",
              ]}
              tip="The month grid is always Sunday–Saturday; scheduling weeks may start on a different day."
              imageSrc="/help/member-calendar.png"
              imageAlt="Calendar month grid with household colors and week markers"
            />

            <HelpSection
              id="notes-and-sharing"
              title="Notes and green/red"
              steps={[
                "When the period is Open for notes, click a day on your week (or any day you care about) to open the drawer.",
                "Add or edit a household note. You can also browse all notes on the Notes page.",
                "Set Sharing preference: Green (open to sharing), Red (prefer not to share), or None.",
                "Green/red rings on the calendar are informational signals for other households — they do not change ownership of the week.",
              ]}
              tip="You can change notes and sharing later during draft and after the schedule is published."
              imageSrc="/help/member-notes-sharing.png"
              imageAlt="Day drawer with notes and green/red sharing preference"
            />

            <HelpSection
              id="my-turn-to-pick"
              title="It’s my turn to pick"
              steps={[
                "Watch for an email or the bell in the nav when it’s your household’s turn (Pick your weeks).",
                "On Calendar, click an open (unassigned) week, or use Period activity if you see it.",
                "Choose Sharing preference (Green / Red / None), then Confirm week in one step.",
                "Need more time? Choose Skip — your turn may come around again depending on the draft rules.",
              ]}
              tip="Sticky alerts at the top of the calendar also link you to the active period when action is needed."
              imageSrc="/help/member-confirm-week.png"
              imageAlt="Confirm week and sharing preference during draft"
            />

            <HelpSection
              id="change-or-release-pick"
              title="Change or release a pick"
              steps={[
                "While the draft is still running (Pick your weeks), open a week you already confirmed.",
                "Pick a different open week and confirm again, or choose Release pick to free the week.",
                "You can do this from the day drawer or Period activity.",
              ]}
              tip="After the period moves to Assign remaining weeks or Schedule set, use Swap weeks instead of release."
              imageSrc="/help/member-revise-pick.png"
              imageAlt="Release pick or revise a confirmed draft pick"
            />

            <HelpSection
              id="after-schedule-set"
              title="After the schedule is set"
              steps={[
                "When status is Schedule set, browse the calendar to see who has each week.",
                "To trade with another household, open Swap weeks (your household must be involved).",
                "Follow the prompts to choose the two weeks and confirm. Check Swap history if you need a reminder of past trades.",
              ]}
              tip="Coordinators can also swap or reassign weeks after publish; reassignments include a required reason and notify households."
              imageSrc="/help/member-swap.png"
              imageAlt="Swap weeks after the schedule is published"
            />

            <HelpSection
              id="settings"
              title="Settings"
              steps={[
                "Open Settings to update your display name or change your password.",
                "Edit your household name and shortcode (1–3 characters shown on calendar badges). Any household member can change these.",
                "Set calendar display preferences: default green/red choice when picking, and how strongly occupancy shows on day cells.",
                "If you are in a coordinator household, you may see a Scheduling tools toggle — turn it on to show Coordinate and Periods in the nav.",
              ]}
              imageSrc="/help/member-settings.png"
              imageAlt="Settings page with account and display preferences"
            />
          </div>

          <div id="coordinators" className="scroll-mt-20 space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Coordinators</h2>
              <p className="text-sm text-slate-600">
                For people with scheduling tools enabled (coordinator household or admin). These steps
                cover running a season — not day-to-day Docker or email ops.
              </p>
            </div>

            <HelpSection
              id="season-at-a-glance"
              title="Season at a glance"
              steps={[
                "Periods — configure the period plan, generate periods, set household priority, Start draft, and Reset period (testing only).",
                "Coordinate — same calendar with Period activity beside it: draft controls, assign remaining weeks, Publish period, and swaps.",
                "Calendar — what every household uses for picks, notes, and viewing the published schedule.",
              ]}
              tip="Reset period clears assignments and draft turns for dry-runs — not for routine production changes."
            />

            <HelpSection
              id="set-up-a-period"
              title="Set up a period"
              steps={[
                "Go to Periods → Period plan (week start, weeks per period, rounds, count).",
                "Use Preview weeks before generating so the date ranges look right.",
                "Generate periods, then set household draft priority as needed.",
                "When notes are done and you’re ready, Start draft. Households then pick on Calendar.",
              ]}
              tip="Periods auto-open for notes at the planned opening time. Use Open on calendar from Periods to jump to that month."
              imageSrc="/help/coord-periods-setup.png"
              imageAlt="Periods page with period plan and preview weeks"
            />

            <HelpSection
              id="during-draft"
              title="During draft"
              steps={[
                "Open Coordinate to see Period activity next to the calendar.",
                "Households pick open weeks (Confirm week) or Skip on their turn; sticky alerts track who is up.",
                "You can also pick or assign from the day drawer when helping a household.",
              ]}
              tip="Emails go out for turn notices, deadline warnings, hold, assignment phase, publish, and assignment changes."
              imageSrc="/help/coord-period-activity.png"
              imageAlt="Coordinate page with Period activity sidebar during draft"
            />

            <HelpSection
              id="hold-and-stuck-turns"
              title="Hold and stuck turns"
              steps={[
                "After 2 consecutive auto-skips, the draft goes on hold — no next turn activates.",
                "In Period activity: Resume draft to continue, Force skip the stuck household, or Pick for household and select a week for them.",
              ]}
              imageSrc="/help/coord-hold.png"
              imageAlt="Period activity hold controls: Resume, Force skip, Pick for household"
            />

            <HelpSection
              id="assign-and-publish"
              title="Assign and publish"
              steps={[
                "When draft ends, status becomes Assign remaining weeks.",
                "Click unassigned days on the calendar (or use Assign week in Period activity) to fill leftover weeks.",
                "Assign Worker Bee weeks manually — Worker Bee is excluded from draft turns (group project weeks).",
                "When every week is assigned, Publish period from Period activity. Status becomes Schedule set.",
              ]}
              imageSrc="/help/coord-assign-publish.png"
              imageAlt="Assign remaining weeks and Publish period"
            />

            <HelpSection
              id="after-publish"
              title="After publish"
              steps={[
                "To change an assignment: click the week → reassign with a required reason. Affected households are notified.",
                "For a straight trade: Period activity → Swap two assigned weeks (reason required when published).",
                "Members can also request Swap weeks when their household is involved.",
              ]}
              tip="Assignment changes appear in Admin → Assignment audit log."
              imageSrc="/help/coord-reassign.png"
              imageAlt="Reassign a published week with a required reason"
            />

            <HelpSection
              id="first-time-admin-setup"
              title="First-time admin setup"
              steps={[
                "Admin → People — invite household members by email.",
                "Admin → Households — set names, shortcodes, colors, mark Worker Bee, and set coordinator household authority (scheduling tools).",
                "Members of a coordinator household turn on Scheduling tools in Settings to see Coordinate and Periods.",
                "Admin → System — pick window and related defaults (admins only).",
              ]}
              tip="Keep this guide short: deeper ops (email, deploy, audit) stay with your admin checklist, not this page."
              imageSrc="/help/coord-admin-setup.png"
              imageAlt="Admin households and people setup"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
