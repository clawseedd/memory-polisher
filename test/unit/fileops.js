/**
 * FileOps Tests
 */

const FileOps = require('../../src/core/fileops');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

describe('FileOps', () => {
    let fileops;
    const mockConfig = {};
    const mockLogger = {
        debug: jest.fn()
    };
    const testDir = path.join(__dirname, '../fixtures/fileops-test');

    beforeAll(async () => {
        await fs.mkdir(testDir, { recursive: true });
    });

    beforeEach(() => {
        fileops = new FileOps(mockConfig, mockLogger);
    });

    afterAll(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('writeAtomic', () => {
        test('should write file atomically', async () => {
            const filepath = path.join(testDir, 'atomic-test.md');
            const content = '# Test Content';

            await fileops.writeAtomic(filepath, content);

            const written = await fs.readFile(filepath, 'utf8');
            expect(written).toBe(content);
        });

        test('should cleanup temp file on error', async () => {
            const filepath = '/invalid/path/file.md';

            await expect(fileops.writeAtomic(filepath, 'test')).rejects.toThrow();

            // Verify no temp files left
            const tempFiles = await fs.readdir(testDir);
            const hasTempFiles = tempFiles.some(f => f.includes('.tmp.'));
            expect(hasTempFiles).toBe(false);
        });
    });

    describe('calculateHash', () => {
        test('should calculate SHA-256 hash', async () => {
            const filepath = path.join(testDir, 'hash-test.md');
            const content = '# Test Content';
            await fs.writeFile(filepath, content, 'utf8');

            const hash = await fileops.calculateHash(filepath);
            const expectedHash = crypto.createHash('sha256').update(content).digest('hex');

            expect(hash).toBe(expectedHash);
        });
    });

    describe('verifyIntegrity', () => {
        test('should verify matching hash', async () => {
            const filepath = path.join(testDir, 'verify-test.md');
            const content = '# Test Content';
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            await fs.writeFile(filepath, content, 'utf8');

            const valid = await fileops.verifyIntegrity(filepath, hash);
            expect(valid).toBe(true);
        });

        test('should detect hash mismatch', async () => {
            const filepath = path.join(testDir, 'mismatch-test.md');
            await fs.writeFile(filepath, '# Content', 'utf8');

            const wrongHash = 'a'.repeat(64);
            const valid = await fileops.verifyIntegrity(filepath, wrongHash);

            expect(valid).toBe(false);
        });
    });

    describe('copySafe', () => {
        test('should copy file with verification', async () => {
            const source = path.join(testDir, 'copy-source.md');
            const dest = path.join(testDir, 'copy-dest.md');
            const content = '# Source Content';

            await fs.writeFile(source, content, 'utf8');
            await fileops.copySafe(source, dest);

            const copied = await fs.readFile(dest, 'utf8');
            expect(copied).toBe(content);
        });
    });

    describe('moveSafe', () => {
        test('should move file atomically', async () => {
            const source = path.join(testDir, 'move-source.md');
            const dest = path.join(testDir, 'move-dest.md');
            const content = '# Move Test';

            await fs.writeFile(source, content, 'utf8');
            await fileops.moveSafe(source, dest);

            const exists = await fileops.exists(dest);
            const sourceExists = await fileops.exists(source);

            expect(exists).toBe(true);
            expect(sourceExists).toBe(false);
        });
    });
});
