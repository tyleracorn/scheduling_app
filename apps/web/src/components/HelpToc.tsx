type TocGroup = {
  heading: string;
  links: { href: string; label: string }[];
};

type HelpTocProps = {
  groups: TocGroup[];
};

export function HelpToc({ groups }: HelpTocProps) {
  return (
    <nav
      aria-label="On this page"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:sticky md:top-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
        On this page
      </p>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.heading}>
            <p className="text-sm font-medium text-slate-800 mb-1.5">{group.heading}</p>
            <ul className="space-y-1">
              {group.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="block text-sm text-slate-600 hover:text-slate-900 hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
