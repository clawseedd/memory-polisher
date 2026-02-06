# Memory Polisher ✨

Intelligent memory organization for OpenClaw agents running on Raspberry Pi or any system.

> Important: the tool expects a `memory/` folder in the **current working directory**.
> When run under OpenClaw, this should be your OpenClaw workspace root.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Development](#development)

## Features

### Core Capabilities

- **Automatic Topic Discovery:** scans hashtags across daily logs
- **Smart merging:** embedding-based similarity when available; Levenshtein fallback
- **Multi-topic handling:** sections with multiple tags get cross-referenced
- **Crash-safe:** atomic writes, backups, and rollback
- **Resume support:** interrupted sessions can be resumed
- **Reports:** writes a markdown report under `memory/.polish-reports/`

## Installation

### Prerequisites

- Node.js 18+
- An OpenClaw workspace with a `memory/` folder

### Install dependencies

```bash
npm install
```

## Usage

### Run via OpenClaw

In chat:

```text
Run memory-polisher
```

### Run locally (CLI)

From your **workspace root** (the folder that contains `memory/`):

```bash
# from inside the skill folder, this will likely FAIL if you don't have ./memory
# so cd to your workspace root first
cd /path/to/openclaw/workspace

node skills/memory-polisher-test/src/index.js
```

## Configuration

Edit `config.yaml` in this skill folder.

Common settings:

```yaml
execution_mode: mechanical  # or enhanced
advanced:
  lookback_days: 7
  topics_directory: Topics/
logging:
  report_location: .polish-reports/
recovery:
  enable_checkpoints: true
  checkpoint_file: .polish-cache/checkpoint.json
```

## Development

### Run tests

```bash
npm test
```

### Lint

```bash
npm run lint
```
