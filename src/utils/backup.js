/**
 * Backup Utility
 * 
 * Responsibilities:
 * - Create file backups before modification
 * - Manage backup lifecycle
 * - Enable rollback
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class Backup {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.backupDir = null;
    }

    /**
     * Initialize backup directory
     */
    async init() {
        this.backupDir = path.join(
            process.cwd(),
            'memory',
            this.config.advanced.cache_directory,
            'backups'
        );

        await fs.mkdir(this.backupDir, { recursive: true });
        return this.backupDir;
    }

    /**
     * Create backup of file
     */
    async create(filepath, content, hash) {
        if (!this.backupDir) await this.init();

        if (!hash) {
            hash = crypto.createHash('sha256').update(content).digest('hex');
        }

        const backupPath = path.join(this.backupDir, `${hash}.md`);

        // Check if backup already exists
        try {
            await fs.access(backupPath);
            return backupPath; // Already backed up
        } catch {
            // Create backup
        }

        await fs.writeFile(backupPath, content, 'utf8');
        return backupPath;
    }

    /**
     * Get backup path for hash
     */
    async getBackupPath(hash) {
        if (!this.backupDir) await this.init();
        return path.join(this.backupDir, `${hash}.md`);
    }

    /**
     * Restore file from backup
     */
    async restore(hash, targetPath) {
        const backupPath = await this.getBackupPath(hash);

        const content = await fs.readFile(backupPath, 'utf8');
        await fs.writeFile(targetPath, content, 'utf8');

        return true;
    }

    /**
     * List all backups
     */
    async list() {
        if (!this.backupDir) await this.init();

        const files = await fs.readdir(this.backupDir);
        return files.filter(f => f.endsWith('.md'));
    }

    /**
     * Clean old backups
     */
    async cleanOld(maxAgeHours) {
        if (!this.backupDir) await this.init();

        const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        const files = await this.list();

        let deleted = 0;

        for (const file of files) {
            const filepath = path.join(this.backupDir, file);
            const stats = await fs.stat(filepath);

            if (stats.mtimeMs < cutoff) {
                await fs.unlink(filepath);
                deleted++;
            }
        }

        return deleted;
    }

    /**
     * Calculate total backup size
     */
    async getTotalSize() {
        if (!this.backupDir) await this.init();

        const files = await this.list();
        let totalSize = 0;

        for (const file of files) {
            const filepath = path.join(this.backupDir, file);
            const stats = await fs.stat(filepath);
            totalSize += stats.size;
        }

        return totalSize;
    }

    /**
     * Delete all backups
     */
    async clear() {
        if (!this.backupDir) await this.init();

        const files = await this.list();

        for (const file of files) {
            await fs.unlink(path.join(this.backupDir, file));
        }

        return files.length;
    }
}

module.exports = Backup;
