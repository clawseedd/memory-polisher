/**
 * Full Polish Integration Test
 */

const fs = require('fs').promises;
const path = require('path');
const MemoryPolisher = require('../../src/index');

describe('Memory Polisher Integration', () => {
    const testDir = path.join(__dirname, '../fixtures/memory');

    beforeAll(async () => {
        // Create test directory structure
        await fs.mkdir(testDir, { recursive: true });

        // Create sample daily log
        const sampleLog = `# Daily Log - 2026-02-05

## Trading Analysis
#trading #python

Analyzed AAPL using Python backtest.

## Code Review
#coding #python

Reviewed PR for new feature.

## Health Note
#health

Went for a run.
`;

        await fs.writeFile(path.join(testDir, 'memory-2026-02-05.md'), sampleLog, 'utf8');
    });

    afterAll(async () => {
        // Cleanup test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    test('should complete full polish cycle', async () => {
        const config = {
            execution_mode: 'mechanical',
            topic_similarity: {
                method: 'levenshtein',
                threshold: 0.8
            },
            advanced: {
                lookback_days: 1,
                min_tag_frequency: 1,
                topics_directory: 'Topics/',
                archive_directory: 'Archive/',
                cache_directory: '.polish-cache/'
            },
            archive: { enabled: false },
            recovery: { enable_checkpoints: true },
            logging: { verbose: false, report_location: '.polish-reports/' },
            performance: { batch_size: 10 },
            cleanup: { auto_cleanup: false },
            synonyms: []
        };

        // Change to test directory
        const originalCwd = process.cwd();
        process.chdir(path.dirname(testDir));

        try {
            const polisher = new MemoryPolisher(config, { dry_run: false });
            const result = await polisher.run();

            expect(result.success).toBe(true);
            expect(result.state.discovered_topics).toBeDefined();

            // Check topic files created
            const topicsDir = path.join(testDir, 'Topics');
            const files = await fs.readdir(topicsDir);

            expect(files).toContain('Trading.md');
            expect(files).toContain('Coding.md');
            expect(files).toContain('Health.md');
        } finally {
            process.chdir(originalCwd);
        }
    }, 30000); // 30 second timeout
});
