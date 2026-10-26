/** Keep arbitrary administrator-supplied URLs out of iframe src attributes. */
export function meetingVideoUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2048 || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return url.href;
  } catch { return null; }
}

function startSeconds(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 2147483647 ? seconds : null;
}

export function meetingVideoEmbed(value: string | null | undefined): { src: string; provider: string } | null {
  const safe = meetingVideoUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  const host = url.hostname;
  let id: string | null = null;
  if (['youtu.be', 'www.youtu.be'].includes(host)) {
    id = url.pathname.match(/^\/([\w-]{11})\/?$/)?.[1] ?? null;
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') :
      url.pathname.match(/^\/(?:embed|live|shorts)\/([\w-]{11})\/?$/)?.[1] ?? null;
  }
  if (id && /^[\w-]{11}$/.test(id)) {
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
    const start = startSeconds(url.searchParams.get('start') ?? url.searchParams.get('t'));
    if (start) embed.searchParams.set('start', String(start));
    return {src: embed.href, provider: 'YouTube'};
  }
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const match = url.pathname.match(host === 'player.vimeo.com' ? /^\/video\/(\d+)\/?$/ : /^\/(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/);
    if (!match) return null;
    const embed = new URL(`https://player.vimeo.com/video/${match[1]}`);
    const hash = url.searchParams.get('h') ?? match[2];
    if (hash && /^[a-zA-Z0-9]{1,128}$/.test(hash)) embed.searchParams.set('h', hash);
    return {src: embed.href, provider: 'Vimeo'};
  }
  return null;
}
