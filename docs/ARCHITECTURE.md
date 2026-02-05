# Architecture Overview

## Design Principles

1. **Mechanical First:** Minimize LLM usage
2. **Crash-Safe:** Atomic operations, never lose data
3. **Resumable:** Checkpoint progress, save compute
4. **Pi-Optimized:** Low RAM, fast execution
5. **Modular:** Clear separation of concerns

## Directory Structure
src/
├── index.js              # Orchestrator (phase flow)
├── phases/               # Phase implementations
│   ├── phase0-init.js    # Safety checks & backups
│   ├── phase1-discover.js # Topic discovery
│   ├── phase2-extract.js # Content extraction
│   ├── phase3-organize.js # File writing & merging
│   ├── phase4-update.js  # Daily log updates
│   ├── phase5-validate.js # Validation & finalize
│   └── phase6-resume.js  # Resume detection
├── core/                 # Core algorithms
│   ├── scanner.js        # Hashtag scanning
│   ├── similarity.js     # Topic similarity
│   ├── parser.js         # Markdown parsing
│   └── fileops.js        # Atomic file operations
└── utils/                # Infrastructure
├── checkpoint.js     # State persistence
├── cache.js          # SQLite embedding cache
├── transaction.js    # Audit logging
├── backup.js         # Backup management
├── embeddings.js     # EmbeddingGemma interface
├── math.js           # Math utilities
└── logger.js         # Structured logging


## Data Flow

Daily Logs
↓
[Phase 1] Discover hashtags → Create topic map
↓
[Phase 2] Extract sections → Cache to disk
↓
[Phase 3] Write topic files → Merge similar topics
↓
[Phase 4] Update daily logs → Archive old files
↓
[Phase 5] Validate → Finalize or rollback


## State Management

**Checkpoint:** Persistent state across phases
**Transaction Log:** Audit trail for rollback
**Extraction Cache:** Temporary section snapshots
**Embedding Cache:** Long-term vector storage

## Error Handling

1. **Atomic Operations:** All file writes are temp → rename
2. **Verification:** Hash checks after every write
3. **Backups:** Original files preserved until verified
4. **Rollback:** Automatic restoration on errors
5. **Resume:** Pick up from last successful phase

## Performance Optimizations

- **Lazy Loading:** Embedding model loaded on demand
- **Batch Processing:** Compute embeddings in batches
- **SQLite Cache:** Avoid recomputing embeddings
- **Sequential I/O:** Safer for SD cards
- **Incremental Updates:** Only process new content

## Extension Points

- Custom similarity methods
- Additional embedding models
- Alternative cache backends
- Custom phase logic
- Plugin system (future)

