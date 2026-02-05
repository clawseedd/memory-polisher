/**
 * FileOps Module
 * 
 * Responsibilities:
 * - Atomic file writes (temp → rename)
 * - File integrity verification
 * - Safe file operations
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FileOps {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    /**
     * Write file atomically (crash-safe)
     * Uses temp file + rename for atomicity
     */
    async writeAtomic(filepath, content) {
        const tempPath = `${filepath}.tmp.${Date.now()}`;

        try {
            // Write to temp file
            await fs.writeFile(tempPath, content, 'utf8');

            // Verify temp file
            const written = await fs.readFile(tempPath, 'utf8');
            if (written !== content) {
                throw new Error('Write verification failed: content mismatch');
            }

            // Atomic rename (commit)
            await fs.rename(tempPath, filepath);

            return true;
        } catch (error) {
            // Cleanup temp file on error
            try {
                await fs.unlink(tempPath);
            } catch {
                // Ignore cleanup errors
            }

            throw new Error(`Atomic write failed for ${filepath}: ${error.message}`);
        }
    }

    /**
     * Read file with error handling
     */
    async readSafe(filepath) {
        try {
            return await fs.readFile(filepath, 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null; // File doesn't exist
            }
            throw error;
        }
    }

    /**
     * Calculate file hash (SHA-256)
     */
    async calculateHash(filepath) {
        const content = await fs.readFile(filepath, 'utf8');
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Verify file integrity by hash
     */
    async verifyIntegrity(filepath, expectedHash) {
        const actualHash = await this.calculateHash(filepath);
        return actualHash === expectedHash;
    }

    /**
     * Copy file with verification
     */
    async copySafe(source, destination) {
        const content = await fs.readFile(source, 'utf8');
        const sourceHash = crypto.createHash('sha256').update(content).digest('hex');

        await this.writeAtomic(destination, content);

        const destHash = await this.calculateHash(destination);

        if (sourceHash !== destHash) {
            throw new Error(`Copy verification failed: ${source} → ${destination}`);
        }

        return true;
    }

    /**
     * Move file with fallback to copy+delete
     */
    async moveSafe(source, destination) {
        try {
            // Try atomic rename first (same filesystem)
            await fs.rename(source, destination);
            return true;
        } catch (error) {
            if (error.code === 'EXDEV') {
                // Cross-filesystem, use copy+delete
                await this.copySafe(source, destination);
                await fs.unlink(source);
                return true;
            }
            throw error;
        }
    }

    /**
     * Check if file exists
     */
    async exists(filepath) {
        try {
            await fs.access(filepath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file size in bytes
     */
    async getSize(filepath) {
        const stats = await fs.stat(filepath);
        return stats.size;
    }

    /**
     * Ensure directory exists
     */
    async ensureDir(dirpath) {
        await fs.mkdir(dirpath, { recursive: true });
    }
}

module.exports = FileOps;
