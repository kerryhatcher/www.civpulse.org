export interface MeetingMember { person_id: string; full_name: string }
export interface MemberMention { start: number; end: number; personId: string }

export function memberProfileHref(id: string): string {
  return `/people/view/?id=${encodeURIComponent(id)}`;
}

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Only names of recorded participants; ambiguous short names stay plain text. */
export function memberMentions(text: string, members: MeetingMember[]): MemberMention[] {
  const patterns = new Map<string, Set<string>>();
  const add = (pattern: string, id: string) => {
    const ids = patterns.get(pattern) ?? new Set<string>();
    ids.add(id); patterns.set(pattern, ids);
  };
  for (const member of members) {
    const words = member.full_name.trim().toLocaleLowerCase('en-US').split(/\s+/);
    add(words.map(escapePattern).join('\\s+'), member.person_id);
    if (words.length > 1) {
      // Includes compound surname variants such as Lisa Garrett-Boyd / Lisa W. Boyd.
      add(`${escapePattern(words[0])}\\s+(?:[\\p{L}]+-)?${escapePattern(words.at(-1)!)}`, member.person_id);
    }
  }
  const matches: MemberMention[] = [];
  for (const [pattern, ids] of patterns) {
    if (ids.size !== 1) continue;
    const regex = new RegExp(`(?<![\\p{L}\\p{N}_-])(?:${pattern})(?![\\p{L}\\p{N}_-])`, 'giu');
    for (const match of text.matchAll(regex)) matches.push({ start: match.index!, end: match.index! + match[0].length, personId: [...ids][0] });
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const unique = matches.filter(match => !matches.some(other =>
    other.personId !== match.personId && other.start === match.start && other.end === match.end));
  const selected: MemberMention[] = [];
  for (const match of unique) {
    if (!selected.length || selected.at(-1)!.end <= match.start) selected.push(match);
  }
  return selected;
}

export function linkMemberMentions(element: HTMLElement, members: MeetingMember[]): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.parentElement?.closest('a, button, script, style')) nodes.push(node);
  }
  for (const node of nodes) {
    const text = node.data;
    const matches = memberMentions(text, members);
    if (!matches.length) continue;
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of matches) {
      fragment.append(text.slice(offset, match.start));
      const link = document.createElement('a');
      link.href = memberProfileHref(match.personId);
      link.textContent = text.slice(match.start, match.end);
      fragment.append(link); offset = match.end;
    }
    fragment.append(text.slice(offset)); node.replaceWith(fragment);
  }
}
