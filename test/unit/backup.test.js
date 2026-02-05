/**
 * Backup Utility Tests
 */

const Backup = require('../../src/utils/backup');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

describe('Backup', () => {
    let backup;
    const mockConfig = {
        advanced: {
            cache_directory: '.polish-cache'
        }
    };
    const mockLogger = {
        debug: jest.fn()
    };

    beforeEach(async () => {
        backup = new Backup(mockConfig, mockLogger);
        await backup.init();
    });

    afterEach(async () => {
        try {
            const files = await backup.list();
            for (const file of files) {
                await fs.unlink(path.join(backup.backupDir, file));
            }
        } catch { }
    });

    describe('create', () => {
        test('should create backup with hash', async () => {
            const content = '# Test Content';
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            const backupPath = await backup.create('test.md', content, hash);

            expect(backupPath).toContain(hash);
            const exists = await fs.access(backupPath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
        });

        test('should not duplicate existing backup', async () => {
            const content = '# Test Content';
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            const path1 = await backup.create('test.md', content, hash);
            const path2 = await backup.create('test.md', content, hash);

            expect(path1).toBe(path2);
        });
    });

    describe('restore', () => {
        test('should restore file from backup', async () => {
            const content = '# Original Content';
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            await backup.create('test.md', content, hash);

            const tempPath = path.join(backup.backupDir, '../test-restore.md');
            await backup.restore(hash, tempPath);

            const restored = await fs.readFile(tempPath, 'utf8');
            expect(restored).toBe(content);

            // Cleanup
            await fs.unlink(tempPath);
        });
    });

    describe('cleanOld', () => {
        test('should delete old backups', async () => {
            const content = '# Test';
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            const backupPath = await backup.create('test.md', content, hash);

            // Set mtime to 10 days ago
            const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
            await fs.utimes(backupPath, tenDaysAgo / 1000, tenDaysAgo / 1000);

            const deleted = await backup.cleanOld(7 * 24); // 7 days

            expect(deleted).toBe(1);
        });
    });

    describe('getTotalSize', () => {
        test('should calculate total backup size', async () => {
            const content1 = '# Test 1';
            const hash1 = crypto.createHash('sha256').update(content1).digest('hex');
            await backup.create('test1.md', content1, hash1);

            const content2 = '# Test 2 with more content';
            const hash2 = crypto.createHash('sha256').update(content2).digest('hex');
            await backup.create('test2.md', content2, hash2);

            const totalSize = await backup.getTotalSize();

            expect(totalSize).toBeGreaterThan(0);
            expect(totalSize).toBe(content1.length + content2.length);
        });
    });
});
