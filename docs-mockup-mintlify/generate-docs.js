const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  console.log('wrote', rel);
}

function existing(title, mapsto, description) {
  return `---
title: "${title}"
---

<Badge color="orange">Existing</Badge>

> Maps to: **${mapsto}**

${description}
`;
}

function netnew(title, description) {
  return `---
title: "${title}"
---

<Badge color="purple">Net-new</Badge>

${description}
`;
}

function ref(title) {
  return `---
title: "${title}"
---
`;
}

// ── Section 1: Agent SDK ───────────────────────────────────────────────────

write('agent-sdk/overview.mdx', `---
title: "Overview"
description: "What the Agent SDK is, when to use it, and what you can build with it."
---

<Badge color="orange">Existing</Badge>

> Maps to: **Overview**

What the Agent SDK is, when to use it over the Claude API or interactive Claude Code, and what you can build with it. Introduces the core model: your code drives Claude as a subprocess.
`);

write('agent-sdk/quickstart.mdx', existing(
  'Quickstart', 'Quickstart',
  'Get a working agent in minutes using a realistic enterprise task — finding and fixing a failing test across a codebase. Covers installation, authentication, and your first query.'
));

write('agent-sdk/compatible-features.mdx', existing(
  'Compatible Claude Code features', 'Use Claude Code features in the SDK',
  'Which Claude Code features — project instructions, skills, hooks, slash commands — are available when running through the SDK, which require extra setup, and which are not programmatically accessible.'
));

write('agent-sdk/message-lifecycle.mdx', netnew(
  'Message lifecycle',
  'What happens during a single `query()` call — from request formation through tool turns and approval cycles to the final response. Helps readers reason about latency, token costs, and where to hook in.'
));

write('agent-sdk/context-window.mdx', netnew(
  'Context window',
  'How the agent manages context across tool turns, how long sessions affect the context window, when content gets truncated, and how to fork or reset to stay within limits.'
));

write('agent-sdk/converting-workflows.mdx', netnew(
  'Converting Claude Code workflows to agent SDK workflows',
  'For developers who already use Claude Code interactively and want to automate those same workflows. Maps common CLI patterns to SDK calls.'
));

// ── Section 2: Setting permissions ────────────────────────────────────────

write('setting-permissions/permission-modes.mdx', existing(
  'Setting permission modes', 'Configure permissions',
  'How to configure what tools the agent can use without prompting — allow-all, deny-all, and rule-based modes. Covers tradeoffs between full autonomy and human-in-the-loop control.'
));

write('setting-permissions/hooks.mdx', existing(
  'Intercepting behavior with hooks', 'Intercept and control agent behavior with hooks',
  'Run your own code before and after tool calls to validate inputs, enforce business rules, log decisions, or block specific operations.'
));

write('setting-permissions/sandbox.mdx', existing(
  'Running tools in the sandbox', 'Configure the sandboxed Bash tool',
  'OS-level filesystem and network isolation for Bash commands. Configure which paths and domains agent-spawned subprocesses can reach.'
));

write('setting-permissions/checkpointing.mdx', existing(
  'Checkpointing and rewinding file changes', 'Rewind file changes with checkpointing',
  'Snapshot the filesystem before risky operations and restore to a known-good state when something goes wrong.'
));

// ── Section 3: Sending requests ───────────────────────────────────────────

write('sending-requests/streaming-queries.mdx', existing(
  'Streaming queries', 'Streaming Input (split)',
  'The primary way to send requests — open a streaming connection that delivers messages as the agent works. Covers long-running tasks, multi-turn conversations, and image input.'
));

write('sending-requests/individual-queries.mdx', existing(
  'Sending individual queries', 'Streaming Input (split)',
  "One-shot request mode for simple, synchronous tasks where real-time output isn't needed. Trade streaming flexibility for simpler code."
));

write('sending-requests/client-class.mdx', existing(
  'Using the client class', 'TypeScript / Python SDK references (promoted)',
  'How to create and reuse a `ClaudeSDKClient` for multiple queries with shared configuration and session state, rather than calling `query()` each time.'
));

write('sending-requests/subagents.mdx', existing(
  'Spawning subagents', 'Subagents in the SDK',
  'Delegate work to specialized sub-agents from within your main agent loop — the Agent tool, prompt construction, and collecting results.'
));

write('sending-requests/custom-prompts.mdx', existing(
  'Setting custom prompts', 'Modifying system prompts',
  'How to set the system prompt, inject context mid-session, and shape how Claude interprets its role in your application.'
));

write('sending-requests/changing-models.mdx', netnew(
  'Changing models',
  'How to target a specific Claude model version per query, and when to use different models for different agent roles — a fast model for subagents, a more capable model for planning.'
));

// ── Section 4: Receiving responses ────────────────────────────────────────

write('receiving-responses/approval-requests.mdx', existing(
  'Approval requests', 'Handle approvals and user input (split)',
  'Handle permission prompts programmatically — approve, deny, or route to an end user when the agent wants to run a sensitive command.'
));

write('receiving-responses/user-questions.mdx', existing(
  'User questions', 'Handle approvals and user input (split)',
  'How the agent surfaces clarifying questions during a task and how to respond with automated answers or route to a real user.'
));

write('receiving-responses/todo-lists.mdx', existing(
  'Tracking and displaying Todo lists', 'Todo Lists',
  'How to read todo update events from the response stream, track agent progress in your UI, and write to the todo list from SDK code.'
));

write('receiving-responses/streaming-output.mdx', existing(
  'Streaming output', 'Stream responses in real-time',
  "Consume the agent's output in real time — text deltas, tool-call events, thinking steps — and display them in a UI."
));

write('receiving-responses/structured-output.mdx', existing(
  'Structured output', 'Get structured output from agents',
  'Get the agent to return JSON or typed data, validate against a schema, and retry on malformed responses.'
));

write('receiving-responses/error-handling.mdx', netnew(
  'Error handling and retry',
  'What happens when Claude errors, times out, or returns an unexpected response. Covers retry strategies, stall detection, and graceful degradation in production.'
));

// ── Section 5: Persisting sessions ────────────────────────────────────────

write('persisting-sessions/saving-restoring.mdx', existing(
  'Saving and restoring sessions', 'Work with sessions',
  'Serialize a session after a query ends and resume, continue, or fork it later — preserving conversation history and tool state.'
));

write('persisting-sessions/external-storage.mdx', existing(
  'Saving sessions to external storage', 'Persist sessions to external storage',
  'Persist session transcripts to a database or object store so sessions survive process restarts and can be shared across deployments.'
));

write('persisting-sessions/sharing-sessions.mdx', netnew(
  'Sharing sessions between hosts',
  'Hand a session from one server instance to another — useful for load balancing, failover, and multi-region deployments.'
));

write('persisting-sessions/subagent-sessions.mdx', netnew(
  'Storing subagent sessions',
  'Manage session state for subagents separately from the parent — when to isolate context, when to share it, and how to resume subagent sessions independently.'
));

// ── Section 6: Custom tools ───────────────────────────────────────────────

write('custom-tools/skills.mdx', existing(
  'Skills', 'Agent Skills in the SDK',
  'Package prompts, tools, and configuration as reusable skills that can be shared and loaded across agents and projects.'
));

write('custom-tools/custom-tools.mdx', existing(
  'Custom tools', 'Give Claude custom tools',
  'Define tools in your own code that the agent can call — input/output types, execution handlers, async patterns, and error reporting.'
));

write('custom-tools/slash-commands.mdx', existing(
  'Custom slash commands', 'Slash Commands in the SDK',
  'Register SDK-side slash commands that users or calling code can invoke during a session to trigger predefined actions.'
));

write('custom-tools/external-mcp.mdx', existing(
  'External MCP servers', 'Connect to external tools with MCP (split)',
  'Connect the agent to tools hosted in external MCP servers over network or stdio transport.'
));

write('custom-tools/embedded-mcp.mdx', netnew(
  'Embedded MCP servers',
  'Bundle an MCP server inside your application process so tools run in-process without external dependencies or network calls.'
));

write('custom-tools/plugins.mdx', existing(
  'Plugins', 'Plugins in the SDK',
  'Extend the SDK with plugins that add behavior across all sessions — hook into the agent loop, register tools globally, or modify prompts.'
));

write('custom-tools/tool-scaling.mdx', existing(
  'Tool scaling', 'Scale to many tools with tool search',
  'When the tool list grows too large for the context window, use tool search to surface only relevant tools per turn.'
));

write('custom-tools/troubleshooting-tools.mdx', netnew(
  'Troubleshooting custom tools',
  'Diagnose common failures — tool registration errors, input schema validation issues, handler exceptions, and timeout behavior.'
));

// ── Section 7: Hosted applications ───────────────────────────────────────

write('hosted-applications/production.mdx', existing(
  'Hosting the SDK in production', 'Hosting the Agent SDK',
  'The subprocess model, what state lives on disk and why it matters, session patterns (ephemeral, long-running, hybrid), multi-tenant isolation, and resource sizing.'
));

write('hosted-applications/cicd-pipelines.mdx', netnew(
  'Running agents in CI/CD pipelines',
  'How to run agents as part of automated pipelines — code review, test generation, release notes — including ephemeral container patterns, parallelism, and cost control.'
));

write('hosted-applications/testing-evaluating.mdx', netnew(
  'Testing and evaluating applications',
  'How to validate agent behavior before deployment — test harnesses, evaluation strategies, and how to assert on what the agent did and did not do.'
));

write('hosted-applications/containerizing.mdx', existing(
  'Containerizing applications', 'Securely deploying AI agents (partial)',
  'Docker and Kubernetes setup for agent workloads — hardened container flags, gVisor for stronger isolation, cloud sandbox providers, and resource limits.'
));

write('hosted-applications/credentials.mdx', existing(
  'Managing credentials securely', 'Securely deploying AI agents (partial)',
  'The proxy pattern for keeping API keys outside the agent boundary, configuring Claude Code to use a proxy, and TLS-terminating proxies for tool credentials.'
));

// ── Section 8: Auditing ───────────────────────────────────────────────────

write('auditing/tracking-cost.mdx', existing(
  'Tracking cost', 'Track cost and usage',
  'Monitor token usage and API costs per session, per user, or across a deployment. Set budgets and surface alerts.'
));

write('auditing/logs-telemetry.mdx', existing(
  'Exporting logs and telemetry', 'Observability with OpenTelemetry',
  'Send agent activity to OpenTelemetry collectors, log aggregators, or custom backends for audit trails and production debugging.'
));

write('auditing/sensitive-data.mdx', netnew(
  'Protecting sensitive data',
  'Scrub credentials, PII, and secrets from logs, session transcripts, and tool inputs before they reach storage or third-party systems.'
));

write('auditing/identifying-users.mdx', netnew(
  'Identifying users',
  'Associate agent sessions with specific end-users for audit trails, per-user rate limiting, cost attribution, and compliance requirements.'
));

// ── Section 9: TypeScript SDK reference ──────────────────────────────────

write('typescript-reference/ts-quickstart.mdx',         ref('Quickstart'));
write('typescript-reference/ts-installation.mdx',       ref('Installation'));
write('typescript-reference/ts-compilation.mdx',        ref('Compilation'));
write('typescript-reference/ts-query-function.mdx',     ref('The query function'));
write('typescript-reference/ts-other-functions.mdx',    ref('Other functions'));
write('typescript-reference/types/function-types.mdx',  ref('Function input and output types'));
write('typescript-reference/types/message-types.mdx',   ref('Message types'));
write('typescript-reference/types/hook-types.mdx',      ref('Hook types'));
write('typescript-reference/types/tool-input-types.mdx', ref('Tool input types'));
write('typescript-reference/types/tool-output-types.mdx', ref('Tool output types'));
write('typescript-reference/types/permission-types.mdx', ref('Permission types'));
write('typescript-reference/types/other-types.mdx',     ref('Other types'));
write('typescript-reference/ts-hooks.mdx',              ref('Hooks'));
write('typescript-reference/ts-sandbox.mdx',            ref('Sandbox'));
write('typescript-reference/troubleshooting/handling-slow-responses.mdx', netnew(
  'Handling slow or stalled responses',
  'How to detect when a streaming query has stalled, set timeouts on individual `query()` calls, and implement retry logic for responses that never complete.'
));

// ── Section 10: Python SDK reference ─────────────────────────────────────

write('python-reference/py-quickstart.mdx',            ref('Quickstart'));
write('python-reference/py-installation.mdx',          ref('Installation'));
write('python-reference/py-query-function.mdx',        ref('The query function'));
write('python-reference/py-client-class.mdx',          ref('The ClaudeSDKClient class'));
write('python-reference/py-other-functions.mdx',       ref('Other functions'));
write('python-reference/types/py-function-types.mdx',  ref('Function input and output types'));
write('python-reference/types/py-message-types.mdx',   ref('Message types'));
write('python-reference/types/py-hook-types.mdx',      ref('Hook types'));
write('python-reference/types/py-tool-input-types.mdx', ref('Tool input types'));
write('python-reference/types/py-tool-output-types.mdx', ref('Tool output types'));
write('python-reference/types/py-permission-types.mdx', ref('Permission types'));
write('python-reference/types/py-other-types.mdx',     ref('Other types'));
write('python-reference/py-hooks.mdx',                 ref('Hooks'));
write('python-reference/py-sandbox.mdx',               ref('Sandbox'));
write('python-reference/troubleshooting/py-handling-slow-responses.mdx', netnew(
  'Handling slow or stalled responses',
  'How to detect when an async generator has stalled, set timeouts on `query()` calls, and implement retry logic for responses that never complete.'
));

// ── mint.json ─────────────────────────────────────────────────────────────

const mintConfig = {
  "$schema": "https://mintlify.com/schema.json",
  "name": "Claude Agent SDK",
  "logo": {
    "light": "/logo/light.svg",
    "dark": "/logo/dark.svg"
  },
  "favicon": "/favicon.svg",
  "colors": {
    "primary": "#D97757",
    "light": "#E8927A",
    "dark": "#B85C3F",
    "background": {
      "light": "#FFFFFF",
      "dark": "#0F172A"
    },
    "anchors": {
      "from": "#D97757",
      "to": "#B85C3F"
    }
  },
  "topbar": {
    "style": "default"
  },
  "sidebar": {
    "style": "sidebar"
  },
  "navigation": [
    {
      "group": "Agent SDK",
      "pages": [
        "agent-sdk/overview",
        "agent-sdk/quickstart",
        "agent-sdk/compatible-features",
        "agent-sdk/message-lifecycle",
        "agent-sdk/context-window",
        "agent-sdk/converting-workflows"
      ]
    },
    {
      "group": "Setting permissions",
      "pages": [
        "setting-permissions/permission-modes",
        "setting-permissions/hooks",
        "setting-permissions/sandbox",
        "setting-permissions/checkpointing"
      ]
    },
    {
      "group": "Sending requests",
      "pages": [
        "sending-requests/streaming-queries",
        "sending-requests/individual-queries",
        "sending-requests/client-class",
        "sending-requests/subagents",
        "sending-requests/custom-prompts",
        "sending-requests/changing-models"
      ]
    },
    {
      "group": "Receiving responses",
      "pages": [
        "receiving-responses/approval-requests",
        "receiving-responses/user-questions",
        "receiving-responses/todo-lists",
        "receiving-responses/streaming-output",
        "receiving-responses/structured-output",
        "receiving-responses/error-handling"
      ]
    },
    {
      "group": "Persisting sessions",
      "pages": [
        "persisting-sessions/saving-restoring",
        "persisting-sessions/external-storage",
        "persisting-sessions/sharing-sessions",
        "persisting-sessions/subagent-sessions"
      ]
    },
    {
      "group": "Extending the SDK with custom tools",
      "pages": [
        "custom-tools/skills",
        "custom-tools/custom-tools",
        "custom-tools/slash-commands",
        "custom-tools/external-mcp",
        "custom-tools/embedded-mcp",
        "custom-tools/plugins",
        "custom-tools/tool-scaling",
        "custom-tools/troubleshooting-tools"
      ]
    },
    {
      "group": "Bundling the SDK in hosted applications",
      "pages": [
        "hosted-applications/production",
        "hosted-applications/cicd-pipelines",
        "hosted-applications/testing-evaluating",
        "hosted-applications/containerizing",
        "hosted-applications/credentials"
      ]
    },
    {
      "group": "Auditing usage",
      "pages": [
        "auditing/tracking-cost",
        "auditing/logs-telemetry",
        "auditing/sensitive-data",
        "auditing/identifying-users"
      ]
    },
    {
      "group": "TypeScript SDK reference",
      "pages": [
        "typescript-reference/ts-quickstart",
        "typescript-reference/ts-installation",
        "typescript-reference/ts-compilation",
        "typescript-reference/ts-query-function",
        "typescript-reference/ts-other-functions",
        {
          "group": "Types",
          "pages": [
            "typescript-reference/types/function-types",
            "typescript-reference/types/message-types",
            "typescript-reference/types/hook-types",
            "typescript-reference/types/tool-input-types",
            "typescript-reference/types/tool-output-types",
            "typescript-reference/types/permission-types",
            "typescript-reference/types/other-types"
          ]
        },
        "typescript-reference/ts-hooks",
        "typescript-reference/ts-sandbox",
        {
          "group": "Troubleshooting",
          "pages": [
            "typescript-reference/troubleshooting/handling-slow-responses"
          ]
        }
      ]
    },
    {
      "group": "Python SDK reference",
      "pages": [
        "python-reference/py-quickstart",
        "python-reference/py-installation",
        "python-reference/py-query-function",
        "python-reference/py-client-class",
        "python-reference/py-other-functions",
        {
          "group": "Types",
          "pages": [
            "python-reference/types/py-function-types",
            "python-reference/types/py-message-types",
            "python-reference/types/py-hook-types",
            "python-reference/types/py-tool-input-types",
            "python-reference/types/py-tool-output-types",
            "python-reference/types/py-permission-types",
            "python-reference/types/py-other-types"
          ]
        },
        "python-reference/py-hooks",
        "python-reference/py-sandbox",
        {
          "group": "Troubleshooting",
          "pages": [
            "python-reference/troubleshooting/py-handling-slow-responses"
          ]
        }
      ]
    }
  ],
  "footerSocials": {}
};

write('mint.json', JSON.stringify(mintConfig, null, 2));

console.log('\nAll docs generated successfully.');
