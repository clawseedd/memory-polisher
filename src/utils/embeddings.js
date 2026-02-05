/**
 * Embeddings Utility
 * 
 * Responsibilities:
 * - Interface with EmbeddingGemma
 * - Batch embedding computation
 * - Cache management
 */

const Cache = require('./cache');

class Embeddings {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.cache = new Cache(config, logger);
        this.model = null;
        this.modelLoaded = false;
    }

    /**
     * Load embedding model (lazy loading)
     */
    async loadModel() {
        if (this.modelLoaded) return this.model;

        this.logger.info('Loading EmbeddingGemma...');

        try {
            // In OpenClaw, embeddings are accessed via the memory search provider
            // This is a simplified interface - actual implementation would use OpenClaw's API

            const modelPath = this.config.topic_similarity.model;

            if (modelPath === 'auto') {
                // Use OpenClaw's configured embedding model
                // This would interface with OpenClaw's memorySearch.local provider
                this.logger.debug('Using OpenClaw embedding provider');
                this.model = {
                    type: 'openclaw',
                    dimensions: this.config.topic_similarity.dimensions || 256
                };
            } else {
                // Load model from explicit path
                this.logger.debug(`Loading model from: ${modelPath}`);
                this.model = {
                    type: 'custom',
                    path: modelPath,
                    dimensions: this.config.topic_similarity.dimensions || 256
                };
            }

            this.modelLoaded = true;
            this.logger.debug('Embedding model loaded');

            return this.model;
        } catch (error) {
            this.logger.error(`Failed to load embedding model: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get embeddings for multiple hashtags (with caching)
     */
    async getEmbeddings(hashtags) {
        await this.loadModel();
        await this.cache.init();

        const embeddings = {};
        const toCompute = [];

        // Check cache first
        for (const tag of hashtags) {
            const cached = await this.cache.getEmbedding(tag);
            if (cached) {
                embeddings[tag] = cached;
            } else {
                toCompute.push(tag);
            }
        }

        if (toCompute.length > 0) {
            this.logger.info(`Computing ${toCompute.length} new embeddings...`);

            // Compute in batches
            const batchSize = this.config.performance.batch_size || 10;

            for (let i = 0; i < toCompute.length; i += batchSize) {
                const batch = toCompute.slice(i, i + batchSize);
                const batchEmbeddings = await this.computeBatch(batch);

                // Cache and store results
                for (const [tag, vector] of Object.entries(batchEmbeddings)) {
                    embeddings[tag] = vector;
                    await this.cache.saveEmbedding(tag, vector, 'embeddinggemma-v1');
                }

                this.logger.debug(`Computed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toCompute.length / batchSize)}`);
            }
        }

        return embeddings;
    }

    /**
     * Compute embeddings for a batch of hashtags
     */
    async computeBatch(hashtags) {
        // This is a placeholder for actual embedding computation
        // In production, this would call EmbeddingGemma via OpenClaw's API

        const embeddings = {};
        const dimensions = this.config.topic_similarity.dimensions || 256;

        for (const tag of hashtags) {
            // Simulate embedding computation
            // In real implementation, this would be:
            // const vector = await openclawAPI.embed(tag);

            // For now, generate deterministic pseudo-embeddings for testing
            embeddings[tag] = this.generatePseudoEmbedding(tag, dimensions);
        }

        return embeddings;
    }

    /**
     * Generate pseudo-embedding for testing
     * (Replace with actual EmbeddingGemma call in production)
     */
    generatePseudoEmbedding(text, dimensions) {
        const vector = new Array(dimensions);

        // Simple hash-based pseudo-embedding
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash = hash & hash;
        }

        // Generate deterministic values
        for (let i = 0; i < dimensions; i++) {
            const seed = hash + i;
            vector[i] = Math.sin(seed) * Math.cos(seed * 0.5);
        }

        // Normalize
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return vector.map(val => val / magnitude);
    }

    /**
     * Truncate embedding to smaller dimensions (Matryoshka)
     */
    truncateEmbedding(vector, targetDimensions) {
        if (vector.length <= targetDimensions) {
            return vector;
        }
        return vector.slice(0, targetDimensions);
    }

    /**
     * Clean up resources
     */
    async close() {
        if (this.cache) {
            await this.cache.close();
        }
    }
}

module.exports = Embeddings;
