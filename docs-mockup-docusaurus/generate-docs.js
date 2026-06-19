const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, 'docs');

function write(rel, content) {
  const full = path.join(DOCS, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  console.log('wrote', rel);
}

function existing(title, pos, mapsto, description) {
  return `---
title: "${title}"
sidebar_position: ${pos}
---

<span className="status-badge status-existing">Existing</span>

> Maps to: **${mapsto}**

${description}
`;
}

function netnew(title, pos, description) {
  return `---
title: "${title}"
sidebar_position: ${pos}
---

<span className="status-badge status-new">Net-new</span>

${description}
`;
}

function ref(title, pos) {
  return `---
title: "${title}"
sidebar_position: ${pos}
---
`;
}

// ── Section 1: Agent SDK ───────────────────────────────────────────────────

write('agent-sdk/overview.md', `---
title: "Overview"
sidebar_position: 1
slug: /
---

<span className="status-badge status-existing">Existing</span>

> Maps to: **Overview**

What the Agent SDK is, when to use it over the Claude API or interactive Claude Code, and what you can build with it. Introduces the core model: your code drives Claude as a subprocess.
`);

write('agent-sdk/quickstart.md', existing(
  'Quickstart', 2, 'Quickstart',
  'Get a working agent in minutes using a realistic enterprise task — finding and fixing a failing test across a codebase. Covers installation, authentication, and your first query.'
));

write('agent-sdk/compatible-features.md', existing(
  'Compatible Claude Code features', 3, 'Use Claude Code features in the SDK',
  'Which Claude Code features — project instructions, skills, hooks, slash commands — are available when running through the SDK, which require extra setup, and which are not programmatically accessible.'
));

write('agent-sdk/message-lifecycle.md', netnew(
  'Message lifecycle', 4,
  'What happens during a single `query()` call — from request formation through tool turns and approval cycles to the final response. Helps readers reason about latency, token costs, and where to hook in.'
));

write('agent-sdk/context-window.md', netnew(
  'Context window', 5,
  'How the agent manages context across tool turns, how long sessions affect the context window, when content gets truncated, and how to fork or reset to stay within limits.'
));

write('agent-sdk/converting-workflows.md', netnew(
  'Converting Claude Code workflows to agent SDK workflows', 6,
  'For developers who already use Claude Code interactively and want to automate those same workflows. Maps common CLI patterns to SDK calls.'
));

// ── Section 2: Setting permissions ────────────────────────────────────────

write('setting-permissions/permission-modes.md', existing(
  'Setting permission modes', 1, 'Configure permissions',
  'How to configure what tools the agent can use without prompting — allow-all, deny-all, and rule-based modes. Covers tradeoffs between full autonomy and human-in-the-loop control.'
));

write('setting-permissions/hooks.md', existing(
  'Intercepting behavior with hooks', 2, 'Intercept and control agent behavior with hooks',
  'Run your own code before and after tool calls to validate inputs, enforce business rules, log decisions, or block specific operations.'
));

write('setting-permissions/sandbox.md', existing(
  'Running tools in the sandbox', 3, 'Configure the sandboxed Bash tool',
  'OS-level filesystem and network isolation for Bash commands. Configure which paths and domains agent-spawned subprocesses can reach.'
));

write('setting-permissions/checkpointing.md', existing(
  'Checkpointing and rewinding file changes', 4, 'Rewind file changes with checkpointing',
  'Snapshot the filesystem before risky operations and restore to a known-good state when something goes wrong.'
));

// ── Section 3: Sending requests ───────────────────────────────────────────

write('sending-requests/streaming-queries.md', existing(
  'Streaming queries', 1, 'Streaming Input (split)',
  'The primary way to send requests — open a streaming connection that delivers messages as the agent works. Covers long-running tasks, multi-turn conversations, and image input.'
));

write('sending-requests/individual-queries.md', existing(
  'Sending individual queries', 2, 'Streaming Input (split)',
  "One-shot request mode for simple, synchronous tasks where real-time output isn't needed. Trade streaming flexibility for simpler code."
));

write('sending-requests/client-class.md', existing(
  'Using the client class', 3, 'TypeScript / Python SDK references (promoted)',
  'How to create and reuse a `ClaudeSDKClient` for multiple queries with shared configuration and session state, rather than calling `query()` each time.'
));

write('sending-requests/subagents.md', existing(
  'Spawning subagents', 4, 'Subagents in the SDK',
  'Delegate work to specialized sub-agents from within your main agent loop — the Agent tool, prompt construction, and collecting results.'
));

write('sending-requests/custom-prompts.md', existing(
  'Setting custom prompts', 5, 'Modifying system prompts',
  'How to set the system prompt, inject context mid-session, and shape how Claude interprets its role in your application.'
));

write('sending-requests/changing-models.md', netnew(
  'Changing models', 6,
  'How to target a specific Claude model version per query, and when to use different models for different agent roles — a fast model for subagents, a more capable model for planning.'
));

// ── Section 4: Receiving responses ────────────────────────────────────────

write('receiving-responses/approval-requests.md', existing(
  'Approval requests', 1, 'Handle approvals and user input (split)',
  'Handle permission prompts programmatically — approve, deny, or route to an end user when the agent wants to run a sensitive command.'
));

write('receiving-responses/user-questions.md', existing(
  'User questions', 2, 'Handle approvals and user input (split)',
  'How the agent surfaces clarifying questions during a task and how to respond with automated answers or route to a real user.'
));

write('receiving-responses/todo-lists.md', existing(
  'Tracking and displaying Todo lists', 3, 'Todo Lists',
  'How to read todo update events from the response stream, track agent progress in your UI, and write to the todo list from SDK code.'
));

write('receiving-responses/streaming-output.md', existing(
  'Streaming output', 4, 'Stream responses in real-time',
  "Consume the agent's output in real time — text deltas, tool-call events, thinking steps — and display them in a UI."
));

write('receiving-responses/structured-output.md', existing(
  'Structured output', 5, 'Get structured output from agents',
  'Get the agent to return JSON or typed data, validate against a schema, and retry on malformed responses.'
));

write('receiving-responses/error-handling.md', netnew(
  'Error handling and retry', 6,
  'What happens when Claude errors, times out, or returns an unexpected response. Covers retry strategies, stall detection, and graceful degradation in production.'
));

// ── Section 5: Persisting sessions ────────────────────────────────────────

write('persisting-sessions/saving-restoring.md', existing(
  'Saving and restoring sessions', 1, 'Work with sessions',
  'Serialize a session after a query ends and resume, continue, or fork it later — preserving conversation history and tool state.'
));

write('persisting-sessions/external-storage.md', existing(
  'Saving sessions to external storage', 2, 'Persist sessions to external storage',
  'Persist session transcripts to a database or object store so sessions survive process restarts and can be shared across deployments.'
));

write('persisting-sessions/sharing-sessions.md', netnew(
  'Sharing sessions between hosts', 3,
  'Hand a session from one server instance to another — useful for load balancing, failover, and multi-region deployments.'
));

write('persisting-sessions/subagent-sessions.md', netnew(
  'Storing subagent sessions', 4,
  'Manage session state for subagents separately from the parent — when to isolate context, when to share it, and how to resume subagent sessions independently.'
));

// ── Section 6: Custom tools ───────────────────────────────────────────────

write('custom-tools/skills.md', existing(
  'Skills', 1, 'Agent Skills in the SDK',
  'Package prompts, tools, and configuration as reusable skills that can be shared and loaded across agents and projects.'
));

write('custom-tools/custom-tools.md', existing(
  'Custom tools', 2, 'Give Claude custom tools',
  'Define tools in your own code that the agent can call — input/output types, execution handlers, async patterns, and error reporting.'
));

write('custom-tools/slash-commands.md', existing(
  'Custom slash commands', 3, 'Slash Commands in the SDK',
  'Register SDK-side slash commands that users or calling code can invoke during a session to trigger predefined actions.'
));

write('custom-tools/external-mcp.md', existing(
  'External MCP servers', 4, 'Connect to external tools with MCP (split)',
  'Connect the agent to tools hosted in external MCP servers over network or stdio transport.'
));

write('custom-tools/embedded-mcp.md', netnew(
  'Embedded MCP servers', 5,
  'Bundle an MCP server inside your application process so tools run in-process without external dependencies or network calls.'
));

write('custom-tools/plugins.md', existing(
  'Plugins', 6, 'Plugins in the SDK',
  'Extend the SDK with plugins that add behavior across all sessions — hook into the agent loop, register tools globally, or modify prompts.'
));

write('custom-tools/tool-scaling.md', existing(
  'Tool scaling', 7, 'Scale to many tools with tool search',
  'When the tool list grows too large for the context window, use tool search to surface only relevant tools per turn.'
));

write('custom-tools/troubleshooting-tools.md', netnew(
  'Troubleshooting custom tools', 8,
  'Diagnose common failures — tool registration errors, input schema validation issues, handler exceptions, and timeout behavior.'
));

// ── Section 7: Hosted applications ───────────────────────────────────────

write('hosted-applications/production.md', existing(
  'Hosting the SDK in production', 1, 'Hosting the Agent SDK',
  'The subprocess model, what state lives on disk and why it matters, session patterns (ephemeral, long-running, hybrid), multi-tenant isolation, and resource sizing.'
));

write('hosted-applications/cicd-pipelines.md', netnew(
  'Running agents in CI/CD pipelines', 2,
  'How to run agents as part of automated pipelines — code review, test generation, release notes — including ephemeral container patterns, parallelism, and cost control.'
));

write('hosted-applications/testing-evaluating.md', netnew(
  'Testing and evaluating applications', 3,
  'How to validate agent behavior before deployment — test harnesses, evaluation strategies, and how to assert on what the agent did and did not do.'
));

write('hosted-applications/containerizing.md', existing(
  'Containerizing applications', 4, 'Securely deploying AI agents (partial)',
  'Docker and Kubernetes setup for agent workloads — hardened container flags, gVisor for stronger isolation, cloud sandbox providers, and resource limits.'
));

write('hosted-applications/credentials.md', existing(
  'Managing credentials securely', 5, 'Securely deploying AI agents (partial)',
  'The proxy pattern for keeping API keys outside the agent boundary, configuring Claude Code to use a proxy, and TLS-terminating proxies for tool credentials.'
));

// ── Section 8: Auditing ───────────────────────────────────────────────────

write('auditing/tracking-cost.md', existing(
  'Tracking cost', 1, 'Track cost and usage',
  'Monitor token usage and API costs per session, per user, or across a deployment. Set budgets and surface alerts.'
));

write('auditing/logs-telemetry.md', existing(
  'Exporting logs and telemetry', 2, 'Observability with OpenTelemetry',
  'Send agent activity to OpenTelemetry collectors, log aggregators, or custom backends for audit trails and production debugging.'
));

write('auditing/sensitive-data.md', netnew(
  'Protecting sensitive data', 3,
  'Scrub credentials, PII, and secrets from logs, session transcripts, and tool inputs before they reach storage or third-party systems.'
));

write('auditing/identifying-users.md', netnew(
  'Identifying users', 4,
  'Associate agent sessions with specific end-users for audit trails, per-user rate limiting, cost attribution, and compliance requirements.'
));

// ── Section 9: TypeScript SDK reference ──────────────────────────────────

write('typescript-reference/ts-quickstart.md',         ref('Quickstart', 1));
write('typescript-reference/ts-installation.md',       ref('Installation', 2));
write('typescript-reference/ts-compilation.md',        ref('Compilation', 3));
write('typescript-reference/ts-query-function.md',     ref('The query function', 4));
write('typescript-reference/ts-other-functions.md',    ref('Other functions', 5));
write('typescript-reference/types/function-types.md',  ref('Function input and output types', 1));
write('typescript-reference/types/message-types.md',   ref('Message types', 2));
write('typescript-reference/types/hook-types.md',      ref('Hook types', 3));
write('typescript-reference/types/tool-input-types.md', ref('Tool input types', 4));
write('typescript-reference/types/tool-output-types.md', ref('Tool output types', 5));
write('typescript-reference/types/permission-types.md', ref('Permission types', 6));
write('typescript-reference/types/other-types.md',     ref('Other types', 7));
write('typescript-reference/ts-hooks.md',              ref('Hooks', 6));
write('typescript-reference/ts-sandbox.md',            ref('Sandbox', 7));
write('typescript-reference/troubleshooting/handling-slow-responses.md', netnew(
  'Handling slow or stalled responses', 1,
  'How to detect when a streaming query has stalled, set timeouts on individual `query()` calls, and implement retry logic for responses that never complete.'
));

// ── Section 10: Python SDK reference ─────────────────────────────────────

write('python-reference/py-quickstart.md',            ref('Quickstart', 1));
write('python-reference/py-installation.md',          ref('Installation', 2));
write('python-reference/py-query-function.md',        ref('The query function', 3));
write('python-reference/py-client-class.md',          ref('The ClaudeSDKClient class', 4));
write('python-reference/py-other-functions.md',       ref('Other functions', 5));
write('python-reference/types/py-function-types.md',  ref('Function input and output types', 1));
write('python-reference/types/py-message-types.md',   ref('Message types', 2));
write('python-reference/types/py-hook-types.md',      ref('Hook types', 3));
write('python-reference/types/py-tool-input-types.md', ref('Tool input types', 4));
write('python-reference/types/py-tool-output-types.md', ref('Tool output types', 5));
write('python-reference/types/py-permission-types.md', ref('Permission types', 6));
write('python-reference/types/py-other-types.md',     ref('Other types', 7));
write('python-reference/py-hooks.md',                 ref('Hooks', 6));
write('python-reference/py-sandbox.md',               ref('Sandbox', 7));
write('python-reference/troubleshooting/py-handling-slow-responses.md', netnew(
  'Handling slow or stalled responses', 1,
  'How to detect when an async generator has stalled, set timeouts on `query()` calls, and implement retry logic for responses that never complete.'
));

console.log('\nAll docs generated successfully.');
