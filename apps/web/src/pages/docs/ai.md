---
layout: ../../layouts/DocsLayout.astro
title: AI plugins, MCP, and skills
description: Connect your AI assistant to Civic Pulse, choose a plugin, and use reusable civic workflows.
---

An AI assistant can search Civic Pulse and, with an administrator account, help maintain records. Choose a plugin for packaged workflows, or connect directly to MCP for live tools. The shared civic skills also work with public sources without an MCP connection. You do not need to run a server to use the hosted service.

## What each part does

- **MCP** (Model Context Protocol) connects your assistant to live Civic Pulse tools. It handles searches and supported actions using your account's permissions.
- A **plugin** packages a connection and other capabilities for a particular AI application, such as ChatGPT, Codex, or Pi.
- A **skill** gives the assistant instructions for a repeatable workflow, such as researching an election or preparing a map. Installing a skill does not sign you in or grant additional access.

Choose [ChatGPT](#connect-in-chatgpt), [Codex](#connect-in-codex), [Pi](#pi), [another MCP client](#connect-another-mcp-client), or [standalone skills](#shared-skills).

## Before connecting live tools

1. [Create a Civic Pulse account](/signup/) if you do not already have one, then [sign in](/signin/). Confirm your email if prompted.
2. Use a client that supports **Streamable HTTP** and **OAuth** for remote MCP servers.
3. Connect with this complete server URL:

```text
https://api.civpulse.org/functions/v1/mcp
```

Each person connects their own account. Regular accounts have read-only access to permitted content. Administrators can also discover hidden content, edit supported records, search registered accounts, and promote another existing user. A connection does not turn a regular account into an administrator.

## Connect in ChatGPT

If the Civic Pulse plugin has been shared with your account, install it from your ChatGPT plugin listing and connect **Civic Pulse MCP (Supabase)** when prompted. The packaged plugin currently uses a private registered connection; its GitHub source is not a public ChatGPT directory listing.

You can also create your own direct MCP connection:

1. Open [ChatGPT Plugins](https://chatgpt.com/plugins), select **Add** or the plus button, then **Add custom MCP server**. Availability depends on your account and workspace policies.
2. Give it a name such as **Civic Pulse**. Choose **Server URL** and paste the full URL above.
3. Select **OAuth** authentication. Let the client discover the authorization endpoints. If asked for a registration method, choose **Dynamic Client Registration (DCR)**; you do not need to supply your own client secret.
4. Review the connection warning, then select **Create as a plugin** and connect the account when prompted.
5. Sign in on the Civic Pulse website. Review the requested profile scopes and account access, then approve if you want to grant that access.
6. Start a new chat, type `@`, select your Civic Pulse connection or plugin, and ask: “Which Civic Pulse account am I connected as?” Then try a search from the examples below.

A direct MCP connection supplies live tools. It does not automatically install the packaged civic skills. See the [official ChatGPT connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt) for the current interface and workspace requirements.

## Connect in Codex

For a direct connection using the Codex CLI, run:

```sh
codex mcp add civpulse \
  --url https://api.civpulse.org/functions/v1/mcp
codex mcp login civpulse
```

Complete the browser sign-in and Civic Pulse consent screen. Start a new Codex chat or reload the client if its tool list has not updated, then ask it to check your connected account and search Civic Pulse. These commands add the live MCP tools; install the OpenAI plugin separately if you also want its bundled skills.

If your Codex application offers a remote MCP settings form, use the same full URL and OAuth flow. Do not paste a password or access token into the chat.

## Connect another MCP client

Add a remote HTTP server named `civpulse`, use the server URL above, and choose OAuth. Some clients accept a configuration shaped like this; use your client's documentation for the exact filename and field names:

```json
{
  "mcpServers": {
    "civpulse": {
      "url": "https://api.civpulse.org/functions/v1/mcp"
    }
  }
}
```

Finish the client's browser authorization flow before calling tools. The configuration contains no credentials. Clients that only accept a static API key cannot complete this OAuth setup without an appropriate integration.

## Plugins and source repositories

### OpenAI, ChatGPT, and Codex

[CivicPulse/civpulse-openai](https://github.com/CivicPulse/civpulse-openai) contains the OpenAI plugin source, bundled skills, tool references, and connection documentation. Follow its README for current releases and supported installation methods. Access to a private ChatGPT connection is separate from access to the source code; if the packaged connection is unavailable to you, use the direct MCP setup above.

To build and check the source package yourself, install Git, Bun, and the `zip`/`unzip` tools, then run:

```sh
git clone https://github.com/CivicPulse/civpulse-openai.git
cd civpulse-openai
bun install --frozen-lockfile
bun run check
bun run build
```

The archive is written under `dist/plugins/`. Building it does not install or publish it. Follow the repository's installation guidance and your host's supported plugin installation flow. For local ChatGPT desktop/Codex testing, OpenAI documents a [local marketplace workflow](https://developers.openai.com/plugins/build/plugins#create-and-test-a-plugin-locally-with-an-mcp-server). The package's registered app mapping must refer to a connection your account can access; do not add credentials to the package.

### Pi

[CivicPulse/civpulse-pi](https://github.com/CivicPulse/civpulse-pi) adds the hosted MCP connection, four bundled civic skills, workflow commands, and a write-confirmation guard to the Pi agent harness. The package requires **Pi 1.3.0 or newer**. Install it with:

```sh
pi install git:github.com/CivicPulse/civpulse-pi
```

Add `--local` to install for the current project instead of your user account. In an existing Pi session, run `/reload` after installation. Then:

1. Run `/civpulse` to inspect the effective server URL, authentication mode, and write-guard setting. The default URL is the hosted endpoint shown above; normal setup needs no environment variables or API key.
2. Run `/mcp`, select **Civic Pulse**, and choose **Sign in**.
3. Complete browser sign-in and the Civic Pulse consent screen with your own account. Pi stores the authorization locally and refreshes it automatically.
4. Ask which account is connected, then try `/civpulse-research upcoming elections in Macon-Bibb`.

The package provides these workflow commands:

- `/civpulse-research <topic>` — research civic records and sources.
- `/civpulse-edit <change>` — create, update, or delete supported content, subject to your account's permissions.
- `/civpulse-map <work>` — work with maps, layers, and geographic features.
- `/civpulse-user-admin <request>` — find accounts or explicitly promote an existing user as an administrator.

You can load a bundled skill explicitly with `/skill:civic-research`. Leave the package's write-confirmation guard enabled and review proposed changes. Its default behavior requires confirmation for writes and blocks them when no confirmation dialog is available; the database still enforces your account's permissions.

If an older configuration takes precedence, inspect `/mcp` and `/civpulse`. A `civpulse` server in your existing `mcp.json` can override the extension's registration. See the [Pi package README](https://github.com/CivicPulse/civpulse-pi#configuration) for configuration and the setup doctor. Bun is required if you run the repository's doctor or tests.

### Shared skills

[CivicPulse/skills](https://github.com/CivicPulse/skills) provides seven standalone civic skills. They work with public sources in supported skill-capable agents, and can use Civic Pulse MCP tools for structured lookups when connected. You do not need a Civic Pulse account or MCP connection to use their public-source workflows.

With Bun installed, preview the collection before choosing what to install:

```sh
bunx skills add CivicPulse/skills --list
```

Install the collection into the current project, then follow the installer's prompts for your agent:

```sh
bunx skills add CivicPulse/skills
```

To select specific skills, or install globally for your user account instead of one project:

```sh
bunx skills add CivicPulse/skills \
  --skill civic-events --skill civic-writing
bunx skills add CivicPulse/skills -g
```

The collection includes:

- **civic-research:** officials, candidates, elections, ballot measures, and organizations.
- **civic-events:** meetings, hearings, civic events, deadlines, and calendar feeds.
- **civic-geography:** districts, precincts, boundaries, GeoJSON, and map layers.
- **civic-data:** budgets, campaign finance, voting records, and open-data cleanup.
- **civic-writing:** biographies, explainers, meeting recaps, and issue briefs.
- **civic-fact-check:** verifying civic claims and preparing sourced corrections.
- **civic-participation:** voting information, contacting officials, public comment, and records requests.

Reload your agent or start a new session after installation. Ask by workflow name, for example: “Use civic-events to find the next public hearing and cite the official notice.” Use your host's skill picker or explicit invocation syntax when available. If a plugin already supplies `civic-research`, install the additional skills you need without unintentionally replacing that bundled workflow.

Installing these skills supplies instructions, not a live account connection. Follow the MCP setup for your client if you also want structured Civic Pulse records. The shared collection has different coverage from the four skills bundled with the OpenAI and Pi plugins; it does not include their admin editing or user-promotion workflows.

## Use skills and live tools together

The OpenAI and Pi packages each bundle four skills for the live Civic Pulse service:

- **civic-research:** find organizations, people, elections, articles, and events, and verify information against sources.
- **civic-editing:** maintain supported records, relationships, images, and your own display name.
- **civic-mapping:** find maps and manage reusable layers and stored geographic features.
- **civic-user-admin:** search registered accounts and promote an existing user when explicitly requested by an administrator.

After installing the plugin, start a new chat with it enabled. Ask in plain language, or name the workflow: “Use civic-research to find upcoming elections in Macon-Bibb.” Your host may also offer a skill picker. The assistant loads a skill when the request matches its workflow or you explicitly invoke it. [OpenAI's skills guide](https://developers.openai.com/plugins/concepts/skills) explains how skills complement MCP tools.

Try these requests:

- “Check which Civic Pulse account I am connected as, then find Macon-Bibb organizations.”
- “Find the next election and list the candidates and available source links.”
- “Use civic-mapping to find existing maps and explain which layers they contain.”
- For admins: “Find this organization, show me its current website address, and propose a correction for my review before saving.”

For changes, identify the exact record and fields. Review names, dates, sources, and the proposed change before authorizing a save or deletion. Do not treat an assistant's summary as a verified source. The database enforces permissions even when a skill suggests an action.

## Access, publishing, and disconnecting

An approved assistant receives your account's supported access, including private content and administrative writes when you are an admin. The consent scopes `openid`, `email`, `profile`, and `offline_access` describe profile access and continued authorization; they do not make an admin connection read-only.

Every MCP tool requires sign-in. Regular users have read-only access; all mutations, including display-name updates, require an admin. Account-directory reads remain admin-only.

Content writes save to the database immediately. Some website views load live data; prerendered public profiles need a separate website rebuild and deployment. Installing a plugin or saving through MCP does not deploy the website. See the [admin guide](/docs/admins/#visibility-and-publication).

To stop access, open [Account → Connected apps](/account/) on Civic Pulse and revoke the client's grant. This rejects its existing MCP access tokens and prevents refresh. You can also remove the connection from your AI client. Keep passwords, access tokens, and secret keys out of prompts, repositories, and configuration examples.

## If setup does not work

- **Old endpoint:** replace `https://mcp.civpulse.org/mcp` with the full `api.civpulse.org/functions/v1/mcp` URL and reconnect. The old host is only a compatibility redirect.
- **401 or sign-in prompt:** complete OAuth or reconnect if the grant was revoked. Opening the MCP URL directly in a browser without a token normally returns an authentication error.
- **No tools or stale tools:** refresh the custom connection's tools in your client, then start a new chat. In ChatGPT, open the connection's settings and use **Refresh tools** when available.
- **Turnout action rejected before reaching Civic Pulse:** `read_turnout` and `import_turnout` belong to `manage_election_results`. A connector error saying these actions are outside the allowed enum means its cached schema is older than the turnout feature. Refresh **Civic Pulse MCP (Supabase)** itself, even if you already updated the packaged Civic Pulse skills. Confirm its action list describes structured Georgia SOS JSON, then retry on a new turn; if the old schema persists, start a new chat with the connection enabled. Verify `read_turnout` succeeds before importing. Repeated calls in the same running turn can retain the old validation schema.
- **Tools work, but skills are missing:** a direct MCP connection supplies tools only. Install the relevant plugin or released skills for your host as well.
- **Permission denied:** verify the connected account. Regular users cannot perform admin operations; ask a Civic Pulse administrator about your role.
- **Changes are not visible on a public profile:** confirm the save, then allow for the site's separate rebuild and deployment.

For website tasks without an AI assistant, use the [visitor guide](/docs/users/) or [admin guide](/docs/admins/).
