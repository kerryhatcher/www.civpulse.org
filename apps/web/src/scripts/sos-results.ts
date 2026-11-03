import { getSupabase } from "../lib/supabase";
import { selectedCounty } from "./county-filter";
import {
  createPublicSosReader,
  readRpcSos,
  sourceCount,
  sourceStatus,
  type SosView,
  type SosObject,
} from "../lib/sos-results-reader";
const stamp = (date: string) =>
  Number.isFinite(Date.parse(date))
    ? new Date(date).toLocaleString("en-US", {
        timeZone: "America/New_York",
        timeZoneName: "short",
      })
    : "Unavailable";
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
}
let dispose: (() => void) | undefined;
export function stopSosResults() {
  dispose?.();
  dispose = undefined;
}
export async function initSosResults(
  electionId: string,
  publicAssets = false,
): Promise<void> {
  dispose?.();
  const root = document.querySelector<HTMLElement>("[data-sos-results]");
  if (!root) return;
  const area = root.querySelector<HTMLSelectElement>(
    "[data-sos-jurisdiction]",
  )!;
  const search = root.querySelector<HTMLInputElement>("[data-sos-search]")!;
  const refresh = root.querySelector<HTMLButtonElement>("[data-sos-refresh]")!;
  const status = root.querySelector<HTMLElement>("[data-sos-status]")!;
  const times = root.querySelector<HTMLElement>("[data-sos-times]")!;
  const content = root.querySelector<HTMLElement>("[data-sos-content]")!;
  const source = root.querySelector<HTMLAnchorElement>("[data-sos-source]")!;
  area.replaceChildren(new Option("Choose a reporting area", ""));
  search.value = "";
  content.replaceChildren();
  times.textContent = "";
  const readPublic = createPublicSosReader();
  let view: SosView | undefined,
    generation = 0,
    stopped = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  let chosen = "",
    checked = "",
    failures = 0;
  const rpc = async (args: Record<string, unknown>) => {
    const { data, error } = await getSupabase().rpc("get_sos_results", args);
    if (error) throw error;
    return data;
  };
  function render() {
    if (!view) return;
    const open = new Set(
      [
        ...content.querySelectorAll<HTMLDetailsElement>(
          "details[open][data-source-id]",
        ),
      ].map((d) => d.dataset.sourceId),
    );
    const focused =
      document.activeElement instanceof HTMLElement &&
      content.contains(document.activeElement)
        ? document.activeElement.closest<HTMLElement>("[data-source-id]")
            ?.dataset.sourceId
        : undefined;
    const fragment = document.createDocumentFragment();
    fragment.append(
      el(
        "p",
        `${view.scope.jurisdiction.name} · ${sourceStatus(view.scope.jurisdiction.reportingStatuses)}`,
      ),
    );
    const query = search.value.trim().toLocaleLowerCase();
    let matches = 0;
    for (const item of view.scope.items) {
      const data = item.data,
        choices = data.ballotOptions as SosObject[];
      if (
        query &&
        ![data.name, ...choices.map((c) => c.name)].some(
          (v) => typeof v === "string" && v.toLocaleLowerCase().includes(query),
        )
      )
        continue;
      matches++;
      const details = el("details");
      details.className = "sos-contest";
      details.dataset.sourceId = String(data.id);
      details.open = open.has(String(data.id)) || !!query;
      details.append(el("summary", String(data.name)));
      details.append(
        el("p", sourceStatus(data.reportingStatus ?? data.reportingStatuses)),
      );
      const table = el("table");
      table.append(
        el(
          "caption",
          `${view.scope.jurisdiction.name} · ${String(data.name)} · Source contest ${String(data.id)}`,
        ),
      );
      const head = el("thead"),
        tr = el("tr");
      for (const label of ["Candidate / choice", "Votes"]) {
        const th = el("th", label);
        th.scope = "col";
        tr.append(th);
      }
      head.append(tr);
      table.append(head);
      const body = el("tbody");
      for (const choice of choices) {
        const row = el("tr"),
          name = el(
            "th",
            typeof choice.name === "string"
              ? choice.name
              : "Unnamed source choice",
          );
        name.scope = "row";
        row.append(name, el("td", sourceCount(choice.voteCount)));
        body.append(row);
      }
      table.append(body);
      details.append(table);
      fragment.append(details);
    }
    if (!matches)
      fragment.append(
        el(
          "p",
          query
            ? "No matching source contests or choices. Clear the search to see all results."
            : "No source contests reported for this area.",
        ),
      );
    // Replace the complete selected scope once; no partial revision is exposed.
    const scroll = window.scrollY;
    content.replaceChildren(fragment);
    root!
      .querySelector<HTMLElement>("[data-sos-fallback]")
      ?.setAttribute("hidden", "");
    if (focused) {
      const target = [
        ...content.querySelectorAll<HTMLDetailsElement>("details"),
      ]
        .find((d) => d.dataset.sourceId === focused)
        ?.querySelector("summary");
      (target ?? area).focus({ preventScroll: true });
    }
    window.scrollTo({ top: scroll, behavior: "instant" });
  }
  function schedule() {
    clearTimeout(timer);
    if (!stopped && !document.hidden && navigator.onLine)
      timer = setTimeout(
        () => void load(),
        Math.min(120000, 30000 * Math.max(1, failures)) + Math.random() * 3000,
      );
  }
  async function load() {
    const request = ++generation;
    clearTimeout(timer);
    if (document.hidden) {
      schedule();
      return;
    }
    if (!navigator.onLine) {
      status.textContent =
        "Offline. Showing the last available SOS results; automatic checks resume when you reconnect.";
      return;
    }
    status.textContent = "Updating SOS results…";
    refresh.disabled = true;
    try {
      let health:
        | {
            status?: string;
            current_revision?: string;
            last_success_at?: string;
          }
        | undefined;
      if (publicAssets) {
        const { data, error } = await getSupabase().rpc(
          "get_sos_results_health",
          { p_election_id: electionId },
        );
        if (error) throw error;
        if (request !== generation || stopped) return;
        health = data ?? undefined;
        if (
          !health?.current_revision ||
          !/^\d+$/.test(health.current_revision) ||
          BigInt(health.current_revision) === 0n
        ) {
          status.textContent =
            "Awaiting automatically published SOS reports. Any published page snapshot remains available below.";
          return;
        }
      }
      const read = (id: string) =>
        publicAssets
          ? readPublic(electionId, id)
          : readRpcSos(rpc, electionId, id, 10000, view);
      let result = await read(chosen);
      if (request !== generation || stopped) return;
      if (!result.pointer) {
        status.textContent =
          "Awaiting SOS reports. Automatic checks run about every 30 seconds while this page is visible.";
        return;
      }
      const old = area.value;
      if (
        [...area.options].map((o) => o.value).join("|") !==
        ["", ...result.pointer.jurisdictions.map((j) => j.id)].join("|")
      ) {
        area.replaceChildren(
          new Option("Choose a reporting area", ""),
          ...result.pointer.jurisdictions.map((j) => new Option(j.name, j.id)),
        );
        area.value = old;
      }
      if (!chosen) {
        // The verified SOS Bibb ID is explicit; all other source areas remain a user choice.
        chosen =
          selectedCounty() === "13021" &&
          result.pointer.jurisdictions.some((j) => j.id === "011")
            ? "011"
            : "";
        area.value = chosen;
        if (chosen) result = await read(chosen);
      }
      if (request !== generation || stopped) return;
      checked = new Date().toISOString();
      failures = 0;
      if (result.pointer) {
        times.textContent = `Source reported: ${stamp(result.pointer.source_created_at)} · Publication: ${stamp(result.pointer.published_at)}${health?.last_success_at ? ` · Successful source check: ${stamp(health.last_success_at)}` : ""} · Successful browser check: ${stamp(checked)}.`;
        if (
          /^https:\/\/results\.sos\.ga\.gov\//.test(result.pointer.source_url)
        )
          source.href = result.pointer.source_url;
      }
      if (result.pointer && result.scope) {
        const changed =
          !view ||
          view.pointer.snapshot_id !== result.pointer.snapshot_id ||
          view.scope.jurisdiction.id !== result.scope.jurisdiction.id;
        view = { pointer: result.pointer, scope: result.scope };
        if (changed) render();
        status.textContent =
          health?.status === "delayed"
            ? "Collection delayed. Showing the latest published SOS results; browser checks continue automatically."
            : health?.status === "paused"
              ? "Source collection is paused. Showing the latest published SOS results; browser checks continue automatically."
              : health?.status === "queued"
                ? "A source update is being collected. Showing the latest published SOS results; browser checks continue automatically."
                : "Current published SOS results. Automatic checks run about every 30 seconds; an unchanged source report is normal.";
      } else {
        content.replaceChildren();
        status.textContent = chosen
          ? "No SOS results for this reporting area. Choose another source area."
          : "Choose an SOS reporting area. Areas are shown separately.";
      }
    } catch {
      if (request !== generation || stopped) return;
      failures++;
      status.textContent = navigator.onLine
        ? `SOS update delayed. ${view ? "Showing the last successful snapshot." : "The published page snapshot remains available when present."} Retrying automatically; select Refresh SOS results to retry now.`
        : "Offline. Showing the last available SOS results; checks resume when you reconnect.";
    } finally {
      if (request === generation && !stopped) {
        refresh.disabled = false;
        schedule();
      }
    }
  }
  const change = () => {
    chosen = area.value;
    void load();
  };
  const filter = () => render();
  const refreshNow = () => {
    void load();
  };
  const visibility = () => {
    if (document.hidden) {
      generation++;
      clearTimeout(timer);
      refresh.disabled = false;
    } else void load();
  };
  const offline = () => {
    generation++;
    clearTimeout(timer);
    refresh.disabled = false;
    status.textContent =
      "Offline. Showing the last available SOS results; checks resume when you reconnect.";
  };
  area.addEventListener("change", change);
  search.addEventListener("input", filter);
  refresh.addEventListener("click", refreshNow);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("online", refreshNow);
  window.addEventListener("offline", offline);
  dispose = () => {
    stopped = true;
    generation++;
    clearTimeout(timer);
    area.removeEventListener("change", change);
    search.removeEventListener("input", filter);
    refresh.removeEventListener("click", refreshNow);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("online", refreshNow);
    window.removeEventListener("offline", offline);
  };
  await load();
}
