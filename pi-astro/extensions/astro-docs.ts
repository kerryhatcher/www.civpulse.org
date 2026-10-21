/**
 * Astro Docs MCP server for Pi.
 *
 * Registers the official, remote Astro documentation MCP server
 * (https://docs.astro.build/en/guides/build-with-ai/) for the current session.
 *
 * The server exposes a single tool, `search_astro_docs`, which searches the
 * current Astro docs through kapa.ai. It is exposed as `direct` so the model can
 * call it whenever it needs up-to-date Astro knowledge without a discovery step.
 *
 * See https://mcp.docs.astro.build/mcp for details.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerMcpServer("astro-docs", {
		// Streamable HTTP transport. Nothing to install locally.
		url: "https://mcp.docs.astro.build/mcp",
		description:
			"Search the latest official Astro documentation (docs.astro.build) for current APIs and best practices.",
		// A single, frequently useful tool: declare it directly instead of
		// hiding it behind codemode/tool_search.
		exposure: "direct",
	});
}
