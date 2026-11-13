import { micromark } from 'micromark';

/** Shared by prerendered profiles and the gated UUID viewer. Never enable raw HTML. */
export function renderProfileDescription(description: string): string {
  return micromark(description, { allowDangerousHtml: false, allowDangerousProtocol: false });
}
