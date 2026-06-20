A history of prompts that I used to create the sample application:

## Research

- What backend could I use to store sessions for free as described in https://code.claude.com/docs/en/agent-sdk/session-storage#write-your-own-adapter? -- vercel KV is sunset, Claude recommends Neon Postgres

## Initial app creation

Similar to the experiment I did in https://github.com/timothymcmackin/claude-agent-spacetraders, create an application that uses the Claude Code Agent SDK in an application that is containerized in a Docker container. The goal is to demonstrate enterprise-level use of the Agent SDK's ability to store and resume sessions. Create the application in `claude-agent-sdk-takehome/sample-app` and do not change files in any other folders. There is a key for the SDK in the `.env` file. Ask me for clarification if you have to make major decisions. For the first run we'll create the code in TypeScript but later we'll provide an equivalent Python version, so be ready for that.

For simplicity there is no authentication in the application. Instead, when a user opens the application they are prompted to select if they are Sam, Henry, or Joan

The application manages a single Git repository. It has a simple web interface that users can provide prompts to. It stores Claude Code Agent SDK sessions in Neon Postgres using the API key in the `.env` file. It remembers which user created the session

When a user connects for the first time, it prompts them to select if they are Sam, Henry -- this is to simulate logging in but I don't want to include actual authentication as part of the sample application. Then it asks the user if they want to start a new session or load one of their

## Planning session — 2026-06-19

The full architecture plan is in `PLAN.md`.

- Help me plan a sample application that illustrates using sessions with the Claude Code Agent SDK. I want to demonstrate storing sessions in neon as above. What do we need to go over to create a sample application that demonstrates enterprise-level session management?

- Add buttons on the interface to allow users to specify that the session is public or private. Private sessions can be opened by any user but private sessions can be opened only by the user that created them. Include tests to ensure that users cannot see sessions that a user has marked private.

- Make sure that the stored sessions include information about who created them and whether they are public or private.

- Use the Neon MCP server to store and retrieve sessions (no direct pg connection — only NEON_KEY management API key needed)

- I want the application to help developers manage the code in a git repository. I was thinking that each session could be tied to a git branch so other developers could load the session and branch and have the history of what was being worked on in the branch. Does that make sense?

- I want the sample application to have a specific goal or purpose. I considered using the SpaceTraders example but am not sure. What do you suggest?

- give some other things that the app could do similar to the task board (settled on: Recipe Manager REST API)

- would option B work when we also provided a version of the code in Python? (yes — the managed repo or the session app itself can have a Python equivalent later)

- let's go with the recipe manager. Add to the plan how we'll create the starter application and a tree of branches that are tied to sessions where the users are working on feature and bugfix branches. 