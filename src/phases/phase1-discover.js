/**
 * Phase 1: Discovery & Analysis
 * 
 * Responsibilities:
 * - Scan hashtags from daily logs
 * - Compute topic similarity
 * - Create canonical topic map
 */

const fs = require('fs').promises;
const path = require('path');
const Scanner = require('../core/scanner');
const Similarity = require('../core/similarity');

class Phase1Discover {
    constructor(config, logger, state) {
        this.config = config;
        this.logger = logger;
        this.state = state;
        this.scanner = new Scanner(config, logger);
        this.similarity = new Similarity(config, logger);
    }

    async execute() {
        // Step 1.1: Hashtag Discovery
        this.logger.phase('Phase 1.1: Hashtag discovery');
        const discoveredTopics = await this.discoverHashtags();

        // Step 1.2: Topic Similarity Analysis
        this.logger.phase('Phase 1.2: Topic similarity analysis');
        const mergeProposals = await this.analyzeSimilarity(discoveredTopics);

        // Step 1.3: Create Canonical Topic Map
        this.logger.phase('Phase 1.3: Creating canonical topic map');
        const canonicalMap = await this.createCanonicalMap(discoveredTopics, mergeProposals);

        this.logger.info(`✓ Discovered ${Object.keys(canonicalMap).length} canonical topics`);

        return {
            discovered_topics: discoveredTopics,
            merge_proposals: mergeProposals,
            canonical_map: canonicalMap,
            similarity_method: this.config.topic_similarity.method
        };
    }

    async discoverHashtags() {
        const memoryDir = path.join(process.cwd(), 'memory');
        const lookbackDays = this.config.advanced.lookback_days || 7;

        // Calculate date range
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - lookbackDays);

        // Find files in date range
        const files = await this.scanner.findDailyLogs(memoryDir, startDate, today);
        this.logger.info(`Scanning ${files.length} files from ${startDate.toISOString().split('T')[0]}`);

        // Scan each file for hashtags
        const allHashtags = {};

        for (const file of files) {
            const filePath = path.join(memoryDir, file);
            const content = await fs.readFile(filePath, 'utf8');

            const hashtags = this.scanner.extractHashtags(content, file);

            // Merge into global hashtag map
            for (const [tag, occurrences] of Object.entries(hashtags)) {
                if (!allHashtags[tag]) {
                    allHashtags[tag] = { count: 0, occurrences: [] };
                }
                allHashtags[tag].count += occurrences.length;
                allHashtags[tag].occurrences.push(...occurrences);
            }
        }

        // Filter noise (tags appearing only once)
        const minFrequency = this.config.advanced.min_tag_frequency || 2;
        const filtered = {};

        for (const [tag, data] of Object.entries(allHashtags)) {
            if (data.count >= minFrequency) {
                filtered[tag] = data;
            }
        }

        const filteredCount = Object.keys(allHashtags).length - Object.keys(filtered).length;
        if (filteredCount > 0) {
            this.logger.debug(`Filtered ${filteredCount} single-use tags`);
        }

        // Log top topics
        const topTopics = Object.entries(filtered)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([tag, data]) => `#${tag}(${data.count})`)
            .join(', ');

        this.logger.info(`Top topics: ${topTopics}`);

        return filtered;
    }

    async analyzeSimilarity(discoveredTopics) {
        const tags = Object.keys(discoveredTopics);

        if (tags.length < 2) {
            this.logger.info('Not enough topics for similarity analysis');
            return [];
        }

        this.logger.info(`Analyzing similarity for ${tags.length} topics...`);

        // Compute pairwise similarity
        const proposals = await this.similarity.computePairwiseSimilarity(tags, discoveredTopics);

        if (proposals.length === 0) {
            this.logger.info('No merge candidates found');
        } else {
            this.logger.info(`Found ${proposals.length} merge candidates:`);
            for (const proposal of proposals) {
                this.logger.info(`  ✓ #${proposal.alias} → #${proposal.canonical} (confidence: ${proposal.confidence.toFixed(2)})`);
            }
        }

        return proposals;
    }

    async createCanonicalMap(discoveredTopics, mergeProposals) {
        const canonicalMap = {};
        const aliasMap = {}; // Track which aliases map to which canonical

        // Initialize with all discovered topics as canonical
        for (const tag of Object.keys(discoveredTopics)) {
            canonicalMap[tag] = {
                canonical: tag,
                aliases: [],
                count: discoveredTopics[tag].count
            };
        }

        // Apply merge proposals
        for (const proposal of mergeProposals) {
            const { canonical, alias, confidence } = proposal;

            // Update canonical entry
            if (canonicalMap[canonical]) {
                canonicalMap[canonical].aliases.push(alias);
                canonicalMap[canonical].count += discoveredTopics[alias]?.count || 0;
            }

            // Remove alias from canonical map
            delete canonicalMap[alias];

            // Track alias mapping
            aliasMap[alias] = canonical;
        }

        return { canonicalMap, aliasMap };
    }
}

module.exports = Phase1Discover;
