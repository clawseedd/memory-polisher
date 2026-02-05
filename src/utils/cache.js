/**
 * Cache Utility
 * 
 * Responsibilities:
 * - SQLite-based caching for embeddings
 * - Extraction cache management
 * - Cache cleanup
 */

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs').promises;

class Cache {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.db = null;
    }

    /**
     * Initialize SQLite database
     */
    async init() {
        const dbPath = path.join(
            process.cwd(),
            'memory',
            this.config.advanced.cache_directory,
            'embeddings',
            'embeddings.db'
        );

        // Ensure directory exists
        await fs.mkdir(path.dirname(dbPath), { recursive: true });

        this.db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Create embeddings table
        await this.db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        hashtag TEXT PRIMARY KEY,
        vector BLOB NOT NULL,
        dimensions INTEGER NOT NULL,
        computed_at INTEGER NOT NULL,
        model_version TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_computed_at ON embeddings(computed_at);
    `);

        return this.db;
    }

    /**
     * Get embedding from cache
     */
    async getEmbedding(hashtag) {
        if (!this.db) await this.init();

        const row = await this.db.get(
            'SELECT vector, dimensions FROM embeddings WHERE hashtag = ?',
            [hashtag]
        );

        if (!row) return null;

        // Deserialize vector
        const buffer = Buffer.from(row.vector);
        const vector = new Float32Array(buffer.buffer, buffer.byteOffset, row.dimensions);
        return Array.from(vector);
    }

    /**
     * Save embedding to cache
     */
    async saveEmbedding(hashtag, vector, modelVersion) {
        if (!this.db) await this.init();

        // Serialize vector
        const float32Array = new Float32Array(vector);
        const buffer = Buffer.from(float32Array.buffer);

        await this.db.run(
            `INSERT OR REPLACE INTO embeddings (hashtag, vector, dimensions, computed_at, model_version)
       VALUES (?, ?, ?, ?, ?)`,
            [hashtag, buffer, vector.length, Date.now(), modelVersion]
        );
    }

    /**
     * Get multiple embeddings
     */
    async getEmbeddings(hashtags) {
        const embeddings = {};

        for (const tag of hashtags) {
            embeddings[tag] = await this.getEmbedding(tag);
        }

        return embeddings;
    }

    /**
     * Clean old cache entries
     */
    async cleanOld(maxAgeSeconds) {
        if (!this.db) await this.init();

        const cutoff = Date.now() - (maxAgeSeconds * 1000);

        const result = await this.db.run(
            'DELETE FROM embeddings WHERE computed_at < ?',
            [cutoff]
        );

        return result.changes;
    }

    /**
     * Get cache statistics
     */
    async getStats() {
        if (!this.db) await this.init();

        const totalRow = await this.db.get('SELECT COUNT(*) as count FROM embeddings');
        const sizeRow = await this.db.get('SELECT SUM(LENGTH(vector)) as size FROM embeddings');

        return {
            count: totalRow.count,
            size: sizeRow.size || 0
        };
    }

    /**
     * Clear entire cache
     */
    async clear() {
        if (!this.db) await this.init();

        await this.db.run('DELETE FROM embeddings');
    }

    /**
     * Close database connection
     */
    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }
}

module.exports = Cache;
