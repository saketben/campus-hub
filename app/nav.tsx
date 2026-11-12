"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/classroom", label: "Classroom" },
  { href: "/gmail", label: "Gmail" },
  { href: "/subjects", label: "Subjects" },
  { href: "/settings", label: "Settings" },
];

// Sections (Stage 6): a tab bar at the bottom of the screen on phones, tabs under
// the header on laptops. Timetable joins when Stage 4 arrives.
export function Nav({ alert }: { alert: boolean }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-background pb-[env(safe-area-inset-bottom)] sm:static sm:border-0 sm:bg-transparent sm:pb-0 dark:border-zinc-800"
    >
      <ul className="mx-auto flex max-w-xl justify-around sm:justify-start sm:gap-1">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? path === "/" : path.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative block px-2 py-3 text-xs font-medium sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm ${
                  active
                    ? "text-blue-700 sm:bg-zinc-100 sm:text-zinc-900 dark:text-blue-400 sm:dark:bg-zinc-900 sm:dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {tab.label}
                {tab.href === "/settings" && alert && (
                  <span aria-label="needs attention" className="absolute right-0.5 top-2 h-2 w-2 rounded-full bg-amber-500" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
