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
homepage: https://github.com/yourusername/openclaw-skills/memory-polisher
---

# Memory Polisher ✨

Intelligent memory organization with automated topic discovery and crash-safe operations.

## Overview

Transforms scattered daily logs into structured topic files using:
- 🔍 Automated hashtag discovery
- 💎 EmbeddingGemma semantic matching (optional)
- 🏷️ Multi-topic sections with cross-references
- 🛡️ Crash-safe atomic operations
- 🔄 Resume support for interrupted sessions

## Quick Start

1. **Add hashtags to daily logs:**
```markdown
## Trading Analysis
#trading #python

Backtested MACD strategy...
2. **Run the skill:**

text
User: "Run memory-polisher"

3. **Check organized topics:**

text
memory/Topics/Trading.md
memory/Topics/Coding.md
Execution Modes
Mechanical (Default): Pure algorithms, no LLM
Enhanced: Uses EmbeddingGemma for better topic merging

Configure in config.yaml:

text
execution_mode: enhanced  # or mechanical
LLM Usage
Type: Embedding model only (NOT generative)
Model: EmbeddingGemma (if available)
Fallback: Levenshtein string distance
Token Cost: Zero (fully local)

Performance (Raspberry Pi 4)
Execution Time: ~14s (with embedding), ~11s (mechanical)

RAM Usage: ~430MB (with embedding), ~250MB (mechanical)

Disk Overhead: ~5MB during execution, ~150KB persistent

Configuration
Edit config.yaml:

text
topic_similarity:
  threshold: 0.82  # Similarity threshold
  method: embedding  # or levenshtein

archive:
  grace_period_days: 3  # Archive delay
  
synonyms:
  - [trading, trade, market]
  - [coding, code, dev]
Scheduling
Weekly polish via cron:

bash
openclaw cron add \
  --name "Weekly Memory Polish" \
  --cron "0 21 * * 0" \
  --session isolated \
  --message "Execute memory-polisher skill"
Safety Features
✅ Atomic file operations (never partial writes)

✅ Automatic backups before modifications

✅ Checkpoint-based resume (power-loss safe)

✅ Automatic rollback on errors

✅ Transaction logging for audit

Troubleshooting
Issue	Solution
No hashtags found	Add #tag to sections
Embedding fails	Auto-falls back to mechanical
Slow execution	Use SSD instead of SD card
See README.md for full documentation.