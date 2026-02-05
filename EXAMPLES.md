# Memory Polisher Examples

## Basic Usage

### Example 1: Simple Daily Log

**Input:** `memory/memory-2026-02-05.md`
```markdown
## Morning Routine
#health

Went for a 5km run. Feeling great.

## Trading Analysis
#trading #python

Backtested MACD strategy on AAPL using Python.
Entry signal at $152 support level.

## Code Review
#coding

Reviewed PR #123 for new authentication feature.
Run polish:

bash
node src/index.js
Output: memory/Topics/Health.md

text
# Health

> Auto-curated notes from daily logs
> Topic: #health
> Last polished: 2026-02-05

***

### 2026-02-05 — [memory-2026-02-05.md](../memory-2026-02-05.md#L0)

## Morning Routine
#health

Went for a 5km run. Feeling great.

**Topics:** #health
**Source:** memory-2026-02-05.md (lines 0-3)
**Hash:** abc123...

***
Output: memory/Topics/Trading.md

text
# Trading

> Auto-curated notes from daily logs
> Topic: #trading
> Last polished: 2026-02-05

***

### 2026-02-05 — [memory-2026-02-05.md](../memory-2026-02-05.md#L5)

## Trading Analysis
#trading #python

Backtested MACD strategy on AAPL using Python.
Entry signal at $152 support level.

**Topics:** #trading #coding
**Source:** memory-2026-02-05.md (lines 5-9)
**Hash:** def456...

***
Output: memory/Topics/Coding.md (cross-reference)

text
# Coding

***

### 2026-02-05 — Cross-Reference

📌 **Full entry:** [Topics/Trading.md](../Trading.md#2026-02-05)

**Preview:** Backtested MACD strategy on AAPL using Python...

**Tags:** #trading #coding
**Related File:** memory-2026-02-05.md

***

### 2026-02-05 — [memory-2026-02-05.md](../memory-2026-02-05.md#L11)

## Code Review
#coding

Reviewed PR #123 for new authentication feature.

**Topics:** #coding
**Source:** memory-2026-02-05.md (lines 11-14)
**Hash:** ghi789...

***
Example 2: Topic Merging
Scenario: You've been using both #trading and #trade inconsistently.

Input: Multiple files with mixed tags

text
## Analysis 1
#trading

Some content...

## Analysis 2
#trade

More content...
Polish detects similarity:

text
Phase 1.2: Topic similarity analysis
Found 1 merge candidate:
  ✓ #trade → #trading (confidence: 0.93)
Result:

All entries merged into Topics/Trading.md

Old Topics/Trade.md moved to Topics/.archive/Trade_merged_2026-02-05.md

All #trade references updated to #trading

Example 3: Multi-Topic Section
Input:

text
## Full-Stack Feature
#frontend #backend #database

Implemented user authentication with:
- React login form
- Node.js API endpoints
- PostgreSQL user table
Output:

Primary: Topics/Frontend.md

text
### 2026-02-05 — [memory-2026-02-05.md](../memory-2026-02-05.md#L10)

## Full-Stack Feature
#frontend #backend #database

[Full content...]

**Topics:** #frontend #backend #database
Secondary: Topics/Backend.md and Topics/Database.md

text
### 2026-02-05 — Cross-Reference

📌 **Full entry:** [Topics/Frontend.md](../Frontend.md#2026-02-05)

**Preview:** Implemented user authentication with...

**Tags:** #frontend #backend #database
Example 4: Resume After Interruption
Session 1:

bash
$ node src/index.js
✨ Memory Polisher v1.0.0 starting...
Phase 1.1: Hashtag discovery
Phase 1.2: Topic similarity analysis
Phase 2.1: Section extraction & caching
^C [User interrupts]
Session 2:

bash
$ node src/index.js
⏸️  Interrupted polish session detected

Session Details:
  Started: 2026-02-05 14:00 (10 minutes ago)
  Last Phase: 2.1
  Progress: 33%

Completed:
  ✓ Phase 1.1
  ✓ Phase 1.2
  ✓ Phase 2.1

Pending:
  ⏳ Phase 3.1
  ⏳ Phase 3.2
  ⏳ Phase 4.1

✓ Resuming from Phase 2.1
[Continues from where it left off]
Example 5: Custom Configuration
Scenario: Financial analyst with specific terminology

config.yaml:

text
synonyms:
  - [spy, spx, sp500, sandp]
  - [btc, bitcoin, xbt]
  - [eth, ethereum]
  - [dxy, dollar, usd]

topic_similarity:
  threshold: 0.85  # Stricter merging

archive:
  grace_period_days: 7  # Keep files longer
Result:

#spy, #spx, #sp500 all merge to #spy

#btc, #bitcoin, #xbt merge to #btc

Files only archived after 7 days

Example 6: Dry Run (Preview)
bash
$ node src/index.js --dry-run
✨ Memory Polisher v1.0.0 starting (DRY RUN)

Phase 1.1: Would scan 7 files
Phase 1.2: Would discover 12 topics
  - Would merge: #trade → #trading
  - Would merge: #py → #python

Phase 2.1: Would extract 45 sections

Phase 3.1: Would create 8 topic files
  - Topics/Trading.md (15 entries)
  - Topics/Coding.md (12 entries)
  - Topics/Health.md (5 entries)

Phase 4.1: Would update 7 daily logs with stubs

✓ Dry run complete. No files modified.
Example 7: Scheduling with Cron
Weekly polish every Sunday at 9 PM:

bash
openclaw cron add \
  --name "Weekly Memory Polish" \
  --cron "0 21 * * 0" \
  --session isolated \
  --message "Execute memory-polisher skill"
Daily polish at midnight:

bash
openclaw cron add \
  --name "Daily Memory Polish" \
  --cron "0 0 * * *" \
  --session isolated \
  --message "Execute memory-polisher with lookback_days: 1"
Example 8: Programmatic Usage
JavaScript:

javascript
const MemoryPolisher = require('./src/index');
const config = require('./config.yaml');

async function polish() {
  const polisher = new MemoryPolisher(config, {
    dry_run: false,
    archive: true,
    verbose: true
  });
  
  const result = await polisher.run();
  
  console.log(`Topics created: ${result.state.topic_files_created}`);
  console.log(`Entries written: ${result.state.entries_written}`);
}

polish().catch(console.error);
Example 9: Error Recovery
Scenario: Disk full during execution

bash
$ node src/index.js
Phase 3.1: Writing topic file entries
✗ Error: ENOSPC: no space left on device

⚠️  Attempting rollback...
✓ All files restored from backups
❌ Session failed. See rollback report.

Your data is safe. Free up space and retry.
All original files intact, no data loss.

Example 10: Custom Lookback Period
Polish last 30 days:

bash
node src/index.js --lookback-days 30
Polish only yesterday:

bash
node src/index.js --lookback-days 1
For more examples and use cases, see README.md and SKILL.md.

text

***

### File: `test/fixtures/README.md`

```markdown
# Test Fixtures

This directory contains sample data for integration tests.

## Structure

fixtures/
└── memory/
├── memory-2026-02-05.md # Sample daily log
└── memory-2026-02-04.md # Another sample log

text

## Usage

Tests in `test/integration/` use these fixtures to verify full polish cycles.

## Adding Fixtures

1. Create realistic daily logs with various hashtags
2. Include edge cases (no tags, multi-tags, similar topics)
3. Add corresponding test in `test/integration/`

## Cleanup

Fixture output (Topics/, Archive/, .polish-cache/) is automatically cleaned after tests.
File: .github/workflows/test.yml (CI/CD)
text
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run tests
      run: npm test
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella

  test-pi:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up QEMU
      uses: docker/setup-qemu-action@v2
    
    - name: Test on ARM (Raspberry Pi simulation)
      run: |
        docker run --rm --platform linux/arm64 \
          -v $PWD:/workspace \
          -w /workspace \
          node:18-alpine \
          sh -c "npm ci && npm test"
