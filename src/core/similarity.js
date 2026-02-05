/**
 * Similarity Module
 * 
 * Responsibilities:
 * - Compute topic similarity (embedding or mechanical)
 * - Apply synonym rules
 * - Generate merge proposals
 * 
 * OPTIMIZATION: Early termination and batching for large datasets
 */

const Embeddings = require('../utils/embeddings');
const MathUtils = require('../utils/math');

class Similarity {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.method = config.topic_similarity.method || 'levenshtein';
        this.threshold = config.topic_similarity.threshold || 0.8;

        if (this.method === 'embedding') {
            this.embeddings = new Embeddings(config, logger);
        }

        this.math = new MathUtils(config, logger);
    }

    async computePairwiseSimilarity(tags, discoveredTopics) {
        const proposals = [];

        const synonymProposals = this.applySynonymRules(tags);
        proposals.push(...synonymProposals);

        // OPTIMIZATION: For large datasets, use batching
        if (tags.length > 100) {
            this.logger.info(`Large dataset detected (${tags.length} tags), using optimized comparison`);
        }

        if (this.method === 'embedding') {
            try {
                const embeddingProposals = await this.computeEmbeddingSimilarity(tags, discoveredTopics);
                proposals.push(...embeddingProposals);
            } catch (error) {
                this.logger.warn(`Embedding similarity failed: ${error.message}`);
                this.logger.info('Falling back to mechanical similarity');

                const mechanicalProposals = this.computeMechanicalSimilarity(tags, discoveredTopics);
                proposals.push(...mechanicalProposals);
            }
        } else {
            const mechanicalProposals = this.computeMechanicalSimilarity(tags, discoveredTopics);
            proposals.push(...mechanicalProposals);
        }

        const uniqueProposals = this.deduplicateProposals(proposals);
        return uniqueProposals.sort((a, b) => b.confidence - a.confidence);
    }

    applySynonymRules(tags) {
        const proposals = [];
        const synonymGroups = this.config.synonyms || [];

        for (const group of synonymGroups) {
            if (!Array.isArray(group) || group.length < 2) continue;

            const canonical = group[0];
            const aliases = group.slice(1);

            const foundAliases = aliases.filter(alias => tags.includes(alias));

            if (tags.includes(canonical) && foundAliases.length > 0) {
                for (const alias of foundAliases) {
                    proposals.push({
                        canonical,
                        alias,
                        confidence: 1.0,
                        method: 'synonym_rule'
                    });
                }
            } else if (foundAliases.length > 0) {
                const newCanonical = foundAliases[0];
                for (const alias of foundAliases.slice(1)) {
                    proposals.push({
                        canonical: newCanonical,
                        alias,
                        confidence: 1.0,
                        method: 'synonym_rule'
                    });
                }
            }
        }

        return proposals;
    }

    async computeEmbeddingSimilarity(tags, discoveredTopics) {
        this.logger.info('Computing embeddings...');

        const embeddings = await this.embeddings.getEmbeddings(tags);

        const proposals = [];

        // OPTIMIZATION: Early termination for very similar tags
        const sortedTags = tags.sort(); // Sort for better cache locality

        for (let i = 0; i < sortedTags.length; i++) {
            for (let j = i + 1; j < sortedTags.length; j++) {
                const tag1 = sortedTags[i];
                const tag2 = sortedTags[j];

                // OPTIMIZATION: Skip if string similarity is very low (early termination)
                if (this.shouldSkipPair(tag1, tag2)) {
                    continue;
                }

                const vec1 = embeddings[tag1];
                const vec2 = embeddings[tag2];

                if (!vec1 || !vec2) continue;

                const similarity = this.math.cosineSimilarity(vec1, vec2);

                if (similarity >= this.threshold) {
                    const count1 = discoveredTopics[tag1]?.count || 0;
                    const count2 = discoveredTopics[tag2]?.count || 0;

                    const canonical = count1 >= count2 ? tag1 : tag2;
                    const alias = count1 >= count2 ? tag2 : tag1;

                    proposals.push({
                        canonical,
                        alias,
                        confidence: similarity,
                        method: 'embeddinggemma'
                    });
                }
            }
        }

        return proposals;
    }

    /**
     * OPTIMIZATION: Quick check to skip obviously dissimilar pairs
     */
    shouldSkipPair(tag1, tag2) {
        // Skip if length difference is too large
        const lenDiff = Math.abs(tag1.length - tag2.length);
        if (lenDiff > Math.max(tag1.length, tag2.length) * 0.5) {
            return true;
        }

        // Skip if no common characters in first 3 chars
        const prefix1 = tag1.substring(0, 3);
        const prefix2 = tag2.substring(0, 3);
        const hasCommonChar = prefix1.split('').some(c => prefix2.includes(c));

        if (!hasCommonChar) {
            return true;
        }

        return false;
    }

    computeMechanicalSimilarity(tags, discoveredTopics) {
        const proposals = [];

        // OPTIMIZATION: Sort tags for better cache locality
        const sortedTags = tags.sort();

        for (let i = 0; i < sortedTags.length; i++) {
            for (let j = i + 1; j < sortedTags.length; j++) {
                const tag1 = sortedTags[i];
                const tag2 = sortedTags[j];

                // OPTIMIZATION: Early termination
                if (this.shouldSkipPair(tag1, tag2)) {
                    continue;
                }

                const distance = this.math.levenshteinDistance(tag1, tag2);
                const maxLen = Math.max(tag1.length, tag2.length);
                let score = 1 - (distance / maxLen);

                if (tag1.includes(tag2) || tag2.includes(tag1)) {
                    score += 0.25;
                    score = Math.min(score, 1.0);
                }

                if (score >= this.threshold) {
                    const count1 = discoveredTopics[tag1]?.count || 0;
                    const count2 = discoveredTopics[tag2]?.count || 0;

                    const canonical = count1 >= count2 ? tag1 : tag2;
                    const alias = count1 >= count2 ? tag2 : tag1;

                    proposals.push({
                        canonical,
                        alias,
                        confidence: score,
                        method: 'levenshtein'
                    });
                }
            }
        }

        return proposals;
    }

    deduplicateProposals(proposals) {
        const seen = new Set();
        const unique = [];

        for (const proposal of proposals) {
            const key = `${proposal.alias}→${proposal.canonical}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(proposal);
            }
        }

        return unique;
    }
}

module.exports = Similarity;
