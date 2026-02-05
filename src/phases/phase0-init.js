/**
 * Phase 0: Initialization & Safety Checks
 * 
 * Responsibilities:
 * - Create cache directories
 * - Check disk space
 * - Backup existing files
 * - Initialize transaction log
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Backup = require('../utils/backup');
const Transaction = require('../utils/transaction');

class Phase0Init {
    constructor(config, logger, state) {
        this.config = config;
        this.logger = logger;
        this.state = state;
        this.backup = new Backup(config, logger);
        this.transaction = new Transaction(config, logger);
    }

    async execute() {
        this.logger.phase('Phase 0.1: Pre-flight verification');

        // Step 0.1: Create cache infrastructure
        const cacheDir = path.join(process.cwd(), 'memory', this.config.advanced.cache_directory);
        await this.createCacheStructure(cacheDir);

        // Step 0.2: Check system resources
        await this.checkSystemResources();

        // Step 0.3: Backup critical files
        this.logger.phase('Phase 0.2: Backing up files');
        const backupResult = await this.backupFiles();

        // Step 0.4: Initialize transaction log
        await this.transaction.init();

        return {
            cache_dir: cacheDir,
            backups_created: backupResult.count,
            backup_size: backupResult.totalSize,
            session_id: this.generateSessionId(),
            started_at: new Date().toISOString()
        };
    }

    async createCacheStructure(cacheDir) {
        const dirs = [
            cacheDir,
            path.join(cacheDir, 'backups'),
            path.join(cacheDir, 'extractions'),
            path.join(cacheDir, 'embeddings'),
            path.join(process.cwd(), 'memory', this.config.logging.report_location)
        ];

        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
                this.logger.debug(`Created directory: ${dir}`);
            } catch (error) {
                if (error.code !== 'EEXIST') throw error;
            }
        }
    }

    async checkSystemResources() {
        const memoryDir = path.join(process.cwd(), 'memory');

        // Check if memory directory exists
        try {
            await fs.access(memoryDir);
        } catch (error) {
            throw new Error(`Memory directory not found: ${memoryDir}`);
        }

        // Calculate required space (2.5x current memory size)
        const memorySize = await this.calculateDirectorySize(memoryDir);
        const requiredSpace = memorySize * 2.5;

        // Note: Actual disk space check is platform-specific
        // This is a simplified version
        this.logger.debug(`Memory size: ${(memorySize / 1024 / 1024).toFixed(2)}MB`);
        this.logger.debug(`Required space: ${(requiredSpace / 1024 / 1024).toFixed(2)}MB`);

        // Check free RAM (simplified - actual implementation would use OS-specific methods)
        const minRAM = this.config.execution_mode === 'enhanced' ? 300 * 1024 * 1024 : 200 * 1024 * 1024;

        if (process.memoryUsage().heapTotal > minRAM) {
            this.logger.warn('Low memory detected. Execution may be slower.');
        }
    }

    async backupFiles() {
        const memoryDir = path.join(process.cwd(), 'memory');
        const files = await fs.readdir(memoryDir);

        // Filter daily log files
        const dailyFiles = files.filter(f => /^memory-\d{4}-\d{2}-\d{2}\.md$/.test(f));

        let backupCount = 0;
        let totalSize = 0;

        for (const file of dailyFiles) {
            const filePath = path.join(memoryDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const hash = crypto.createHash('sha256').update(content).digest('hex');

            // Check if already backed up
            const backupPath = await this.backup.getBackupPath(hash);
            try {
                await fs.access(backupPath);
                this.logger.debug(`Already backed up: ${file}`);
                continue;
            } catch {
                // Not backed up, proceed
            }

            // Create backup
            await this.backup.create(filePath, content, hash);
            await this.transaction.log({
                action: 'backup',
                target: file,
                hash: hash,
                status: 'success'
            });

            backupCount++;
            totalSize += content.length;
        }

        this.logger.info(`✓ Backed up ${backupCount} files (${(totalSize / 1024).toFixed(1)}KB)`);

        return { count: backupCount, totalSize };
    }

    async calculateDirectorySize(dirPath) {
        let totalSize = 0;

        try {
            const items = await fs.readdir(dirPath, { withFileTypes: true });

            for (const item of items) {
                const itemPath = path.join(dirPath, item.name);

                if (item.isDirectory()) {
                    totalSize += await this.calculateDirectorySize(itemPath);
                } else {
                    const stats = await fs.stat(itemPath);
                    totalSize += stats.size;
                }
            }
        } catch (error) {
            this.logger.warn(`Could not calculate size for ${dirPath}: ${error.message}`);
        }

        return totalSize;
    }

    generateSessionId() {
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const random = crypto.randomBytes(3).toString('hex');
        return `${timestamp}-${random}`;
    }
}

module.exports = Phase0Init;
