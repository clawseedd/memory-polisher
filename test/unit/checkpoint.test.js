/**
 * Checkpoint Utility Tests
 */

const Checkpoint = require('../../src/utils/checkpoint');
const fs = require('fs').promises;
const path = require('path');

describe('Checkpoint', () => {
    let checkpoint;
    const mockConfig = {
        recovery: {
            checkpoint_file: '.polish-cache/test-checkpoint.json'
        }
    };

    beforeEach(() => {
        checkpoint = new Checkpoint(mockConfig);
    });

    afterEach(async () => {
        // Cleanup
        try {
            await fs.unlink(checkpoint.checkpointPath);
        } catch { }
    });

    describe('save', () => {
        test('should save checkpoint to disk', async () => {
            const state = {
                current_phase: '1',
                completed_steps: ['0', '1'],
                discovered_topics: { trading: { count: 5 } }
            };

            await checkpoint.save(state);

            const exists = await checkpoint.exists();
            expect(exists).toBe(true);
        });

        test('should include version and timestamps', async () => {
            const state = { current_phase: '2' };
            await checkpoint.save(state);

            const loaded = await checkpoint.load();
            expect(loaded.version).toBe('1.0.0');
            expect(loaded.started_at).toBeDefined();
            expect(loaded.updated_at).toBeDefined();
        });
    });

    describe('load', () => {
        test('should load saved checkpoint', async () => {
            const state = {
                current_phase: '3',
                completed_steps: ['0', '1', '2', '3']
            };

            await checkpoint.save(state);
            const loaded = await checkpoint.load();

            expect(loaded.current_phase).toBe('3');
            expect(loaded.completed_steps).toEqual(['0', '1', '2', '3']);
        });

        test('should return null if checkpoint does not exist', async () => {
            const loaded = await checkpoint.load();
            expect(loaded).toBeNull();
        });

        test('should reject checkpoint with mismatched base path', async () => {
            const state = { current_phase: '1' };
            await checkpoint.save(state);

            // Manually modify checkpoint to have wrong base path
            const content = await fs.readFile(checkpoint.checkpointPath, 'utf8');
            const data = JSON.parse(content);
            data.base_path = '/wrong/path';
            await fs.writeFile(checkpoint.checkpointPath, JSON.stringify(data), 'utf8');

            await expect(checkpoint.load()).rejects.toThrow('base path mismatch');
        });
    });

    describe('calculateProgress', () => {
        test('should calculate progress percentage', () => {
            const checkpointData = { current_phase: '3' };
            const progress = checkpoint.calculateProgress(checkpointData);

            expect(progress).toBe(50); // Phase 3 of 6 = 50%
        });

        test('should handle phase 0', () => {
            const checkpointData = { current_phase: '0' };
            const progress = checkpoint.calculateProgress(checkpointData);

            expect(progress).toBe(0);
        });
    });

    describe('generateSessionId', () => {
        test('should generate unique session IDs', () => {
            const id1 = checkpoint.generateSessionId();
            const id2 = checkpoint.generateSessionId();

            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^\d{14}-[a-z0-9]{6}$/);
        });
    });
});
