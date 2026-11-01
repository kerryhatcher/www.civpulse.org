/** Keep the public evidence readable while live/snapshot enhancement is pending
 * or fails. A successful replacement hides it once; pagination never restores it. */
export function replacePublishedEvidence(root: HTMLElement | null): void {
  const evidence = root?.querySelector<HTMLElement>('[data-public-profile-evidence]');
  if (evidence) evidence.hidden = true;
}
