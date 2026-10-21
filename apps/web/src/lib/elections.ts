import { getBuildSupabase } from './supabase-build';

export type ElectionVisibility = 'public' | 'unlisted' | 'private';
export type ElectionKind =
  | 'special'
  | 'special_runoff'
  | 'primary'
  | 'primary_runoff'
  | 'general'
  | 'general_runoff'
  | 'other';
export type ElectionDateKind =
  | 'election_day'
  | 'early_voting'
  | 'registration_deadline'
  | 'absentee_request_deadline'
  | 'absentee_return_deadline'
  | 'other';
export type CandidateStatus =
  | 'running'
  | 'withdrawn'
  | 'won'
  | 'lost'
  | 'runoff'
  | 'pending';

export const ELECTION_KIND_LABELS: Record<ElectionKind, string> = {
  special: 'Special election',
  special_runoff: 'Special election runoff',
  primary: 'Primary',
  primary_runoff: 'Primary runoff',
  general: 'General election',
  general_runoff: 'General election runoff',
  other: 'Election',
};

export const ELECTION_VISIBILITY_LABELS: Record<ElectionVisibility, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

export const ELECTION_DATE_KIND_LABELS: Record<ElectionDateKind, string> = {
  election_day: 'Election day',
  early_voting: 'Early voting',
  registration_deadline: 'Registration deadline',
  absentee_request_deadline: 'Mail ballot request deadline',
  absentee_return_deadline: 'Mail ballot return deadline',
  other: 'Key date',
};

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  running: 'Running',
  withdrawn: 'Withdrawn',
  won: 'Won',
  lost: 'Lost',
  runoff: 'In runoff',
  pending: 'Pending',
};

/** Display order for grouped key dates on the election page. */
export const ELECTION_DATE_KIND_ORDER: ElectionDateKind[] = [
  'registration_deadline',
  'absentee_request_deadline',
  'early_voting',
  'absentee_return_deadline',
  'election_day',
  'other',
];

export interface Election {
  id: string;
  slug: string;
  name: string;
  election_date: string;
  kind: ElectionKind;
  description: string | null;
  organization_id: string | null;
  visibility: ElectionVisibility;
}

/** A person as referenced from a contest, with the race-specific facts. */
export interface ElectionCandidate {
  person: {
    id: string;
    slug: string;
    full_name: string;
    kind: string;
    title: string | null;
    image_path: string | null;
    visibility: ElectionVisibility;
  };
  party: string | null;
  status: CandidateStatus;
  position: number;
}

export interface ElectionContest {
  id: string;
  election_id: string;
  office: string;
  district: string | null;
  seat: string | null;
  description: string | null;
  partisan: boolean;
  position: number;
  candidates: ElectionCandidate[];
}

/** An event that is a key date for an election, as returned by get_election. */
export interface ElectionDate {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  url: string | null;
  visibility: ElectionVisibility;
  election_date_kind: ElectionDateKind | null;
  calendar_id: string;
  calendar_name: string;
  calendar_slug: string;
}

export interface ElectionDetail {
  election: Election;
  organization: { id: string; slug: string; name: string } | null;
  contests: ElectionContest[];
  dates: ElectionDate[];
}

export const ELECTION_COLUMNS =
  'id, slug, name, election_date, kind, description, organization_id, visibility';

/** The shared election viewer shell. Unlisted and private elections are uuid-only. */
export function electionHref(election: {
  id: string;
  slug: string;
  visibility: ElectionVisibility;
}): string {
  return election.visibility === 'public'
    ? `/elections/${election.slug}/`
    : `/elections/view/?id=${election.id}`;
}

/** Loads public elections at build time; returns an empty list without a database. */
export async function fetchPublicElections(): Promise<Election[]> {
  const supabase = getBuildSupabase();
  if (!supabase) {
    console.warn('[elections] PUBLIC_SUPABASE_* not set; skipping election pages.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('elections')
      .select(ELECTION_COLUMNS)
      .eq('visibility', 'public')
      .order('election_date', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Election[];
  } catch (error) {
    console.warn(`[elections] Could not load elections: ${String(error)}`);
    return [];
  }
}

/** Full detail (contests, candidates, key dates) for one election. */
export async function fetchElectionDetail(id: string): Promise<ElectionDetail | null> {
  const supabase = getBuildSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc('get_election', { p_id: id });
    if (error) throw error;

    const response = data as {
      status?: string;
      election?: Election;
      organization?: ElectionDetail['organization'];
      contests?: ElectionContest[];
      dates?: ElectionDate[];
    } | null;

    if (!response || response.status !== 'ok' || !response.election) return null;

    return {
      election: response.election,
      organization: response.organization ?? null,
      contests: response.contests ?? [],
      dates: response.dates ?? [],
    };
  } catch (error) {
    console.warn(`[elections] Could not load election ${id}: ${String(error)}`);
    return null;
  }
}

const ELECTION_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
};

/** Formats a `date` column (YYYY-MM-DD) without timezone drift. */
export function formatElectionDate(value: string, options = ELECTION_DATE_FORMAT): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, options);
}

/** Short label for grouping key dates, e.g. "Registration deadline". */
export function electionDateKindLabel(kind: ElectionDateKind | null): string {
  return kind ? ELECTION_DATE_KIND_LABELS[kind] ?? 'Key date' : 'Key date';
}
