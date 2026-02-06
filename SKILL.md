---
name: memory-polisher
description: Intelligently organizes daily memory logs with automated hashtag discovery, multi-topic handling, and smart topic merging
version: 1.0.0
license: MIT
metadata:
  openclaw:
    emoji: "✨"
    bins:
      - node
    os:
      - darwin
      - linux
      - win32
allowed-tools:
  - fs
  - datetime
homepage: https://github.com/openclaw-community/memory-polisher
---

# Memory Polisher ✨

Intelligent memory organization with automated topic discovery and crash-safe operations.

## Overview

Transforms scattered daily logs into structured topic files using:

- Automated hashtag discovery
- Semantic similarity (embedding) when available; otherwise Levenshtein fallback
- Multi-topic sections with cross-references
- Crash-safe atomic operations + backups
- Resume support for interrupted sessions

## Quick Start

### 1) Add hashtags to daily logs

Example (`memory/YYYY-MM-DD.md`):

```markdown
## Trading Analysis
#trading #python

Backtested MACD strategy...
```

### 2) Run the skill

In chat with OpenClaw:

```text
Run memory-polisher
```

### 3) Check output

Topic files (default):

```text
memory/Topics/Trading.md
memory/Topics/Coding.md
```

## Execution modes

- **mechanical** (default / safest): pure algorithms, no LLM
- **enhanced**: uses embedding model if available for better merges; falls back automatically

Configure in `config.yaml`:

```yaml
execution_mode: enhanced  # or mechanical
```

## Scheduling (example)

Weekly polish via OpenClaw cron:

```bash
openclaw cron add \
  --name "Weekly Memory Polish" \
  --cron "0 21 * * 0" \
  --session isolated \
  --message "Execute memory-polisher skill"
```

## Safety features

- Atomic file operations (no partial writes)
- Automatic backups before modification
- Checkpoint-based resume (power-loss safe)
- Automatic rollback on errors
- Transaction logging for audit

## Notes on running location (important)

This skill expects a `memory/` folder in the current working directory.
When run inside OpenClaw, it should be executed from your OpenClaw workspace root (the folder that contains `memory/`).

See `README.md` for full documentation.
