FROM node:20-alpine

# git is required: the agent runs git commands inside worktrees
RUN apk add --no-cache git

WORKDIR /app

# Enterprise Pattern #2: container-ephemeral local writes
# Claude Code writes session files to CLAUDE_CONFIG_DIR; /tmp vanishes on restart.
# The real session data lives in Neon (the SessionStore mirror).
ENV CLAUDE_CONFIG_DIR=/tmp

# Copy session-manager app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

# Copy Recipe Manager source and patches for the init script
COPY workspace/ /workspace-init/

# Initialize the managed git repo with all demo branches (idempotent)
RUN mkdir -p /workspace/worktrees && \
    sh /workspace-init/init-repo.sh

EXPOSE 3000

CMD ["node", "--import", "tsx/esm", "src/index.ts"]
