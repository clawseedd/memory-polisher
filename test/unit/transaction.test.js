/**
 * Transaction Log Tests
 */

const Transaction = require('../../src/utils/transaction');
const fs = require('fs').promises;

describe('Transaction', () => {
    let transaction;
    const mockConfig = {
        advanced: {
            cache_directory: '.polish-cache'
        }
    };
    const mockLogger = {
        error: jest.fn()
    };

    beforeEach(async () => {
        transaction = new Transaction(mockConfig, mockLogger);
        await transaction.init();
    });

    afterEach(async () => {
        try {
            await fs.unlink(transaction.logPath);
        } catch { }
    });

    describe('log', () => {
        test('should write transaction to log', async () => {
            await transaction.log({
                action: 'backup',
                target: 'test.md',
                status: 'success'
            });

            const logs = await transaction.read();
            expect(logs).toHaveLength(1);
            expect(logs[0].action).toBe('backup');
        });

        test('should include timestamp', async () => {
            await transaction.log({ action: 'test' });

            const logs = await transaction.read();
            expect(logs[0].timestamp).toBeDefined();
            expect(new Date(logs[0].timestamp)).toBeInstanceOf(Date);
        });

        test('should handle concurrent writes', async () => {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(transaction.log({ action: `test-${i}` }));
            }

            await Promise.all(promises);

            const logs = await transaction.read();
            expect(logs).toHaveLength(10);
        });
    });

    describe('getByAction', () => {
        test('should filter by action', async () => {
            await transaction.log({ action: 'backup', target: 'file1' });
            await transaction.log({ action: 'write', target: 'file2' });
            await transaction.log({ action: 'backup', target: 'file3' });

            const backups = await transaction.getByAction('backup');
            expect(backups).toHaveLength(2);
            expect(backups.every(t => t.action === 'backup')).toBe(true);
        });
    });

    describe('getFailed', () => {
        test('should return only failed transactions', async () => {
            await transaction.log({ action: 'test1', status: 'success' });
            await transaction.log({ action: 'test2', status: 'failed' });
            await transaction.log({ action: 'test3', status: 'success' });

            const failed = await transaction.getFailed();
            expect(failed).toHaveLength(1);
            expect(failed[0].status).toBe('failed');
        });
    });

    describe('clear', () => {
        test('should clear all logs', async () => {
            await transaction.log({ action: 'test' });
            await transaction.clear();

            const logs = await transaction.read();
            expect(logs).toHaveLength(0);
        });
    });
});
