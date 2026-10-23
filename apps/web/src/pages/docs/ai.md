---
layout: ../../layouts/DocsLayout.astro
title: AI plugins, MCP, and skills
description: Connect your AI assistant to Civic Pulse, choose a plugin, and use reusable civic workflows.
---

An AI assistant can search Civic Pulse and, with an administrator account, help maintain records. Start with a direct MCP connection if you want to use the live service today. You do not need to run a server or build a plugin to connect.

## What each part does

- **MCP** (Model Context Protocol) connects your assistant to live Civic Pulse tools. It handles searches and supported actions using your account's permissions.
- A **plugin** packages a connection and other capabilities for a particular AI application, such as ChatGPT, Codex, or Pi.
- A **skill** gives the assistant instructions for a repeatable workflow, such as researching an election or preparing a map. Installing a skill does not sign you in or grant additional access.

Choose [ChatGPT](#connect-in-chatgpt), [Codex](#connect-in-codex), [another MCP client](#connect-another-mcp-client), or read about [plugins and their repositories](#plugins-and-source-repositories).

## Before connecting

1. [Create a Civic Pulse account](/signup/) if you do not already have one, then [sign in](/signin/). Confirm your email if prompted.
2. Use a client that supports **Streamable HTTP** and **OAuth** for remote MCP servers.
3. Connect with this complete server URL:

```text
https://api.civpulse.org/functions/v1/mcp
```

Each person connects their own account. Regular accounts can research permitted public content and update their own display name. Administrators can also discover hidden content, edit supported records, search registered accounts, and promote another existing user. A connection does not turn a regular account into an administrator.

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

[CivicPulse/civpulse-pi](https://github.com/CivicPulse/civpulse-pi) is the repository for the Pi agent harness plugin. Its current README is a placeholder and does not yet publish an installation or authentication procedure. Check that repository for the released package and its instructions before installing. A repository link alone does not add MCP support to Pi.

When the plugin's setup is available, connect it to the same Civic Pulse MCP URL, authorize your own account, and test identity and search before requesting edits. If you already use an OAuth-capable MCP integration in Pi, configure that integration using its own documentation and the endpoint above.

### Shared skills

[CivicPulse/skills](https://github.com/CivicPulse/skills) is the planned home for shared Civic Pulse skills. It currently has a placeholder README, so no standalone skill installation procedure is published there yet. For now, the OpenAI plugin includes the workflows described below. Follow the shared repository's instructions when those skills are released for your chosen host.

## Use skills and live tools together

The OpenAI package currently includes four skills:

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

Content writes save to the database immediately. Some website views load live data; prerendered public profiles need a separate website rebuild and deployment. Installing a plugin or saving through MCP does not deploy the website. See the [admin guide](/docs/admins/#visibility-and-publication).

To stop access, open [Account → Connected apps](/account/) on Civic Pulse and revoke the client's grant. This rejects its existing MCP access tokens and prevents refresh. You can also remove the connection from your AI client. Keep passwords, access tokens, and secret keys out of prompts, repositories, and configuration examples.

## If setup does not work

- **Old endpoint:** replace `https://mcp.civpulse.org/mcp` with the full `api.civpulse.org/functions/v1/mcp` URL and reconnect. The old host is only a compatibility redirect.
- **401 or sign-in prompt:** complete OAuth or reconnect if the grant was revoked. Opening the MCP URL directly in a browser without a token normally returns an authentication error.
- **No tools or stale tools:** refresh the custom connection's tools in your client, then start a new chat. In ChatGPT, open the connection's settings and use **Refresh tools** when available.
- **Tools work, but skills are missing:** a direct MCP connection supplies tools only. Install the relevant plugin or released skills for your host as well.
- **Permission denied:** verify the connected account. Regular users cannot perform admin operations; ask a Civic Pulse administrator about your role.
- **Changes are not visible on a public profile:** confirm the save, then allow for the site's separate rebuild and deployment.

For website tasks without an AI assistant, use the [visitor guide](/docs/users/) or [admin guide](/docs/admins/).
