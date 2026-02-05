/**
 * Transaction Log Utility
 * 
 * Responsibilities:
 * - Audit trail of all operations
 * - Enable rollback
 * - Track file modifications
 * 
 * FIX: Use atomic append with write serialization to prevent race conditions
 */

const fs = require('fs').promises;
const path = require('path');

class Transaction {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.logPath = null;
        this.writeLock = Promise.resolve(); // Serialize writes
    }

    async init() {
        const logDir = path.join(
            process.cwd(),
            'memory',
            this.config.advanced.cache_directory
        );

        await fs.mkdir(logDir, { recursive: true });

        this.logPath = path.join(logDir, 'transaction.log');

        try {
            await fs.access(this.logPath);
        } catch {
            await fs.writeFile(this.logPath, '', 'utf8');
        }

        return this.logPath;
    }

    /**
     * FIX: Atomic log append with write serialization
     */
    async log(transaction) {
        if (!this.logPath) await this.init();

        const entry = {
            timestamp: new Date().toISOString(),
            phase: transaction.phase || 'unknown',
            action: transaction.action,
            target: transaction.target || null,
            status: transaction.status || 'success',
            ...transaction
        };

        const line = JSON.stringify(entry) + '\n';

        // FIX: Serialize writes to prevent race conditions
        this.writeLock = this.writeLock.then(async () => {
            try {
                await fs.appendFile(this.logPath, line, {
                    encoding: 'utf8',
                    flag: 'a' // Atomic append mode
                });
            } catch (error) {
                this.logger.error(`Transaction log failed: ${error.message}`);
                throw error;
            }
        });

        await this.writeLock;
    }

    async read() {
        if (!this.logPath) await this.init();

        try {
            const content = await fs.readFile(this.logPath, 'utf8');
            const lines = content.trim().split('\n').filter(l => l.length > 0);
            return lines.map(line => JSON.parse(line));
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async getByAction(action) {
        const transactions = await this.read();
        return transactions.filter(t => t.action === action);
    }

    async getFailed() {
        const transactions = await this.read();
        return transactions.filter(t => t.status === 'failed');
    }

    async getReverse() {
        const transactions = await this.read();
        return transactions.reverse();
    }

    async clear() {
        if (!this.logPath) await this.init();
        await fs.writeFile(this.logPath, '', 'utf8');
    }

    async archive() {
        if (!this.logPath) await this.init();

        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const archivePath = this.logPath.replace('.log', `_${timestamp}.log`);

        await fs.rename(this.logPath, archivePath);
        await fs.writeFile(this.logPath, '', 'utf8');

        return archivePath;
    }
}

module.exports = Transaction;
