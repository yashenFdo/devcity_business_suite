// Small, framework-free helpers shared by the People directory and Team settings.
import { differenceInCalendarDays, differenceInMonths, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { DEPARTMENT_SUGGESTIONS, type EmploymentStatus, type TeamMember } from '../../store/useAccessStore';

const parse = (iso?: string) => {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? d : null;
};

/** "2 yrs 3 mos", "8 mos", "New this month", or "Starts in 5 days" for future start dates. */
export const tenure = (startDate?: string, now = new Date()): string | null => {
  const start = parse(startDate);
  if (!start) return null;
  if (start > now) {
    const days = differenceInCalendarDays(start, now);
    return days <= 1 ? 'Starts tomorrow' : `Starts in ${days} days`;
  }
  const months = differenceInMonths(now, start);
  if (months < 1) return 'New this month';
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} ${y === 1 ? 'yr' : 'yrs'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'mo' : 'mos'}`);
  return parts.join(' ');
};

/** "3 hours ago" style label; `fallback` when the date is missing. */
export const relativeTime = (iso?: string, fallback = 'Never'): string => {
  const d = parse(iso);
  if (!d) return fallback;
  if (Date.now() - d.getTime() < 60_000) return 'Just now';
  return formatDistanceToNowStrict(d, { addSuffix: true });
};

/** Last-seen label tuned for presence: recent activity reads as "Active now". */
export const lastActiveLabel = (iso?: string): string => {
  const d = parse(iso);
  if (!d) return 'Never';
  if (Date.now() - d.getTime() < 5 * 60_000) return 'Active now';
  return formatDistanceToNowStrict(d, { addSuffix: true });
};

export const errorMessage = (e: unknown, fallback = 'Something went wrong. Please try again.') =>
  e instanceof Error && e.message ? e.message : fallback;

/** Copies text; resolves false (instead of throwing) when the browser blocks clipboard access. */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const isCurrent = (status: EmploymentStatus) => status !== 'left';

/** Members who keep the workspace administrable (the server refuses to remove the last one). */
export const activeAdminCount = (members: TeamMember[]) => members.filter((m) => m.role === 'admin' && m.status !== 'left').length;

const uniqueSorted = (values: (string | undefined)[]) =>
  Array.from(new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));

export const departmentOptions = (members: TeamMember[]) => uniqueSorted([...DEPARTMENT_SUGGESTIONS, ...members.map((m) => m.department)]);

const TITLE_SUGGESTIONS = [
  'Software Engineer',
  'Senior Software Engineer',
  'Tech Lead',
  'QA Engineer',
  'UI/UX Designer',
  'Product Manager',
  'Project Manager',
  'DevOps Engineer',
  'Business Analyst',
  'Accountant',
  'HR Executive',
  'Sales Executive',
];

export const jobTitleOptions = (members: TeamMember[]) => uniqueSorted([...TITLE_SUGGESTIONS, ...members.map((m) => m.jobTitle)]);

/** Only allow https avatar images (profile URLs come from the identity provider). */
export const safeAvatarUrl = (url?: string) => (url && /^https:\/\//i.test(url) ? url : undefined);

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
