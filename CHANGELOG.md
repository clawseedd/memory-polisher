
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-05

### Added
- Initial release of Memory Polisher
- Automated hashtag discovery and topic extraction
- EmbeddingGemma integration for semantic topic similarity
- Mechanical fallback using Levenshtein distance
- Crash-safe atomic file operations
- Checkpoint-based resume support (saves 70-90% compute on retry)
- Multi-topic section handling with cross-references
- Smart topic merging with configurable thresholds
- Automatic link healing after archiving
- Comprehensive validation and rollback system
- Transaction logging for audit trail
- Backup system with automatic restoration
- SQLite-based embedding cache
- Polish reports with growth metrics
- Configurable synonym rules
- Optimized for Raspberry Pi 4 (8GB)

### Performance
- Execution time: ~14s with EmbeddingGemma, ~11s mechanical (Pi 4)
- RAM usage: ~430MB with embedding, ~250MB mechanical
- Disk overhead: ~5MB during execution, ~150KB persistent
- Supports 7-90 day lookback periods

### Documentation
- Complete SKILL.md for OpenClaw integration
- Comprehensive README with installation guide
- Troubleshooting guide
- Contributing guidelines
- API documentation for all modules

### Testing
- Unit tests for core modules (scanner, similarity, math)
- Integration tests for full polish cycle
- >70% code coverage

## [Unreleased]

### Planned
- Web UI for interactive topic management
- Support for additional embedding models (BERT, Sentence-BERT)
- GraphQL API for programmatic access
- Topic hierarchy and parent-child relationships
- Natural language queries for topic search
- Export to Obsidian graph view
- Mobile companion app

---

[1.0.0]: https://github.com/yourusername/memory-polisher/releases/tag/v1.0.0
