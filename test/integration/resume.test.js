/**
 * Resume Functionality Integration Test
 */

const MemoryPolisher = require('../../src/index');
const Checkpoint = require('../../src/utils/checkpoint');
const fs = require('fs').promises;
const path = require('path');

describe('Resume Functionality', () => {
    const testDir = path.join(__dirname, '../fixtures/resume-test/memory');
    let config;

    beforeAll(async () => {
        await fs.mkdir(testDir, { recursive: true });

        // Create sample log
        const sampleLog = `# Daily Log

## Trading Note
#trading

Test content.
`;
        await fs.writeFile(path.join(testDir, 'memory-2026-02-05.md'), sampleLog, 'utf8');

        config = {
            execution_mode: 'mechanical',
            topic_similarity: { method: 'levenshtein', threshold: 0.8 },
            advanced: {
                lookback_days: 1,
                min_tag_frequency: 1,
                topics_directory: 'Topics/',
                archive_directory: 'Archive/',
                cache_directory: '.polish-cache/'
            },
            archive: { enabled: false },
            recovery: {
                enable_checkpoints: true,
                checkpoint_file: '.polish-cache/checkpoint.json'
            },
            logging: { verbose: false, report_location: '.polish-reports/' },
            performance: { batch_size: 10 },
            cleanup: { auto_cleanup: false },
            synonyms: []
        };
    });

    afterAll(async () => {
        await fs.rm(path.dirname(testDir), { recursive: true, force: true });
    });

    test('should save checkpoint during execution', async () => {
        const originalCwd = process.cwd();
        process.chdir(path.dirname(testDir));

        try {
            const polisher = new MemoryPolisher(config);

            // Interrupt after phase 1 (mock)
            const originalExecute = polisher.executePhases;
            polisher.executePhases = async function () {
                await this.checkpoint.save({
                    current_phase: '1',
                    completed_steps: ['0', '1'],
                    session_id: 'test-session'
                });
                throw new Error('Simulated interruption');
            };

            await expect(polisher.run()).rejects.toThrow('Simulated interruption');

            // Verify checkpoint exists
            const checkpoint = new Checkpoint(config);
            const exists = await checkpoint.exists();
            expect(exists).toBe(true);

            const data = await checkpoint.load();
            expect(data.current_phase).toBe('1');
            expect(data.completed_steps).toContain('1');
        } finally {
            process.chdir(originalCwd);
        }
    }, 30000);

    test('should resume from checkpoint', async () => {
        const originalCwd = process.cwd();
        process.chdir(path.dirname(testDir));

        try {
            // Create checkpoint manually
            const checkpoint = new Checkpoint(config);
            await checkpoint.save({
                current_phase: '2',
                completed_steps: ['0', '1', '2'],
                session_id: 'resume-test',
                discovered_topics: { trading: { count: 1 } },
                canonical_map: { canonicalMap: {}, aliasMap: {} }
            });

            const polisher = new MemoryPolisher(config);
            const result = await polisher.run();

            expect(result.resumed).toBe(true);
            expect(result.success).toBe(true);
        } finally {
            process.chdir(originalCwd);
        }
    }, 30000);
});
