# Memory Polisher ✨

Intelligent memory organization for OpenClaw agents running on Raspberry Pi or any system.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## Features

### Core Capabilities

- **🔍 Automatic Topic Discovery:** Scans hashtags across daily logs
- **💎 Smart Merging:** Uses EmbeddingGemma to detect similar topics (#trade → #trading)
- **🏷️ Multi-Topic Handling:** Sections with multiple tags get cross-referenced
- **🔗 Link Healing:** Automatically updates links after archiving
- **🛡️ Crash-Safe:** Atomic writes, backups, and automatic rollback
- **🔄 Resume Support:** Picks up interrupted sessions (saves compute time)
- **📊 Rich Reports:** Growth metrics and topic statistics

### Design Principles

1. **Mechanical First:** 90% pure algorithms, minimal LLM usage
2. **Safety First:** Never delete until verified
3. **Pi-Optimized:** Low RAM (~430MB), fast execution (~14s)
4. **Fully Local:** No API calls, no token costs

## Installation

### Prerequisites

- OpenClaw installed and running
- Node.js 18+ (included with OpenClaw)
- EmbeddingGemma (optional, for better accuracy)
- 500MB free RAM
- 10MB free disk space

### Step 1: Clone Skill

```bash
cd ~/.openclaw/agents/YOUR_AGENT_NAME/skills/
git clone https://github.com/yourusername/memory-polisher.git

# Or download manually
mkdir memory-polisher
cd memory-polisher
# Copy all files from repository
