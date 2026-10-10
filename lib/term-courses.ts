// Courses offered this term, from the official elective list Saket provides at the
// start of each term ("List of electives offered for Term - V", PGPM 2025-27).
// Used only to pre-tick the course picker: a Classroom course that matches this
// list is very likely a current course. Students always confirm or change the ticks.
// To switch terms, replace this list (code + title + area only; no faculty details).

export const CURRENT_TERM = "PGPM 2025-27, Term V";

export const CURRENT_TERM_COURSES: { code: string; title: string; area: string }[] = [
  { code: "GTM", title: "Game Theory for Managers", area: "E&PP" },
  { code: "CBM", title: "Commercial Bank Management", area: "F&A" },
  { code: "FDRM", title: "Financial Derivatives and Risk Management", area: "F&A" },
  { code: "IF", title: "International Finance", area: "F&A" },
  { code: "MACR", title: "Mergers, Acquisitions, and Corporate Restructuring", area: "F&A" },
  { code: "PF", title: "Project Finance", area: "F&A" },
  { code: "LAE", title: "Legal Aspects of Entrepreneurship", area: "GEN" },
  { code: "ISDC", title: "Intelligent Systems Design and Consulting", area: "IS&A" },
  { code: "EB-EC", title: "E-Business and E-Commerce", area: "IS&A" },
  { code: "TAM", title: "Text Analytics for Managers", area: "IS&A" },
  { code: "ADPM", title: "Advanced Digital Product Management", area: "IS&A" },
  { code: "MMM", title: "Marketing Metrics for Managers", area: "MKTG" },
  { code: "IM", title: "International Marketing", area: "MKTG" },
  { code: "SDM", title: "Sales and Distribution Management", area: "MKTG" },
  { code: "PRS", title: "Pricing Strategy", area: "MKTG" },
  { code: "MBPC", title: "Marketing to the Base of Pyramid Consumers", area: "MKTG" },
  { code: "B2B", title: "Business to Business Marketing", area: "MKTG" },
  { code: "BSF", title: "Business Forecasting", area: "OM&DS" },
  { code: "SCM", title: "Supply Chain Management", area: "OM&DS" },
  { code: "MIT 4.0", title: "Managing Industry 4.0 Transformation", area: "OM&DS" },
  { code: "BDDM", title: "Behavioral Dynamics in Decision Making", area: "OM&DS" },
  { code: "RMDA", title: "Revenue Management Decision Analytics", area: "OM&DS" },
  { code: "MDPW", title: "Managing Difficult People At Work", area: "OB&HRM" },
  { code: "SR", title: "Strategic Renewal", area: "STG&EP" },
  { code: "EPS", title: "Entrepreneurial Strategy and New Venture Creation", area: "STG&EP" },
  { code: "BS-PPP", title: "Business Sustainability - For People, Planet, and Profits", area: "GEN & STG&EP" },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// True if a Classroom course name contains a current course's code as a whole word
// (so "MMM_26" matches MMM but "MM I" doesn't, and "DPM 2026" doesn't match ADPM),
// or contains its full title.
export function isCurrentTermCourse(classroomName: string): boolean {
  const name = classroomName.toLowerCase();
  return CURRENT_TERM_COURSES.some(
    ({ code, title }) =>
      new RegExp(`(^|[^a-z0-9])${escape(code.toLowerCase())}([^a-z0-9]|$)`).test(name) ||
      name.includes(title.toLowerCase()),
  );
}
