/**
 * Phase 2: Content Extraction
 * 
 * Responsibilities:
 * - Parse markdown sections
 * - Detect hashtags in sections
 * - Cache extractions to disk
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Parser = require('../core/parser');
const Cache = require('../utils/cache');

class Phase2Extract {
    constructor(config, logger, state) {
        this.config = config;
        this.logger = logger;
        this.state = state;
        this.parser = new Parser(config, logger);
        this.cache = new Cache(config, logger);
    }

    async execute() {
        this.logger.phase('Phase 2.1: Section extraction & caching');

        const memoryDir = path.join(process.cwd(), 'memory');
        const lookbackDays = this.config.advanced.lookback_days || 7;

        // Get file list (normalize to whole days in local time)
        const now = new Date();

        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);

        const startDate = new Date(now);
        startDate.setDate(now.getDate() - lookbackDays);
        startDate.setHours(0, 0, 0, 0);

        const files = await this.getFileList(memoryDir, startDate, endDate);
        this.logger.info(`Extracting sections from ${files.length} files`);

        const allExtractions = [];
        let totalSections = 0;

        for (const file of files) {
            const filePath = path.join(memoryDir, file);
            const content = await fs.readFile(filePath, 'utf8');

            // Parse markdown into sections
            const sections = await this.parser.parseSections(content, file);

            // Process each section
            for (const section of sections) {
                // Skip already-polished stubs to avoid recursive re-polishing
                if (this.isPolishedStub(section.content)) {
                    this.logger.debug(`Skipping polished stub section: ${section.title}`);
                    continue;
                }

                // Detect hashtags in section
                const hashtags = this.detectHashtags(section.content);

                if (hashtags.length === 0) {
                    this.logger.debug(`Skipping untagged section: ${section.title}`);
                    continue;
                }

                // Map hashtags to canonical topics
                const canonicalTags = this.mapToCanonical(hashtags);

                if (canonicalTags.length === 0) {
                    this.logger.debug(`No canonical mappings for section: ${section.title}`);
                    continue;
                }

                // Assign primary and secondary topics
                const primaryTopic = canonicalTags[0];
                const secondaryTopics = canonicalTags.slice(1);

                // Create extraction object
                const extraction = {
                    id: this.generateExtractionId(file, section.index),
                    source_file: file,
                    source_line_start: section.lineStart,
                    source_line_end: section.lineEnd,
                    section_title: section.title,
                    primary_topic: primaryTopic,
                    secondary_topics: secondaryTopics,
                    full_content: section.content,
                    content_hash: crypto.createHash('sha256').update(section.content).digest('hex'),
                    extracted_at: new Date().toISOString()
                };

                // Cache extraction
                await this.cacheExtraction(extraction);

                allExtractions.push(extraction);
                totalSections++;
            }

            this.logger.debug(`Extracted ${sections.length} sections from ${file}`);
        }

        this.logger.info(`✓ Cached ${totalSections} sections from ${files.length} files`);

        return {
            extractions: allExtractions,
            extraction_count: totalSections,
            files_processed: files
        };
    }

    async getFileList(memoryDir, startDate, endDate) {
        // Reuse scanner logic: scan all .md files under memory/, excluding Topics/ etc.
        const Scanner = require('../core/scanner');
        const scanner = new Scanner(this.config, this.logger);
        return scanner.findDailyLogs(memoryDir, startDate, endDate);
    }

    isPolishedStub(content) {
        if (!content) return false;
        // Markers produced by Phase4Update.generateDailyLogStub
        const hasPolishArrow = content.includes('→ **Polished to') || content.includes('→ **Primary:**');
        const hasTopicsLink = content.includes('Topics/') || content.includes('Topics\\');
        return hasPolishArrow && hasTopicsLink;
    }

    detectHashtags(content) {
        const pattern = /#([a-z0-9_-]+)\b/gi;
        const hashtags = [];
        let match;

        while ((match = pattern.exec(content)) !== null) {
            const tag = match[1].toLowerCase();
            if (!hashtags.includes(tag)) {
                hashtags.push(tag);
            }
        }

        return hashtags;
    }

    mapToCanonical(hashtags) {
        const { canonicalMap, aliasMap } = this.state.canonical_map || { canonicalMap: {}, aliasMap: {} };
        const mapped = [];

        for (const tag of hashtags) {
            // Check if tag is an alias
            if (aliasMap[tag]) {
                const canonical = aliasMap[tag];
                if (!mapped.includes(canonical)) {
                    mapped.push(canonical);
                }
            }
            // Check if tag is already canonical
            else if (canonicalMap[tag]) {
                if (!mapped.includes(tag)) {
                    mapped.push(tag);
                }
            }
        }

        return mapped;
    }

    generateExtractionId(filename, sectionIndex) {
        const dateMatch = filename.match(/memory-(\d{4})-(\d{2})-(\d{2})/);
        const dateStr = dateMatch ? `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}` : 'unknown';
        return `${dateStr}-${String(sectionIndex).padStart(2, '0')}`;
    }

    async cacheExtraction(extraction) {
        const cacheDir = path.join(
            process.cwd(),
            'memory',
            this.config.advanced.cache_directory,
            'extractions'
        );

        const filename = `${extraction.id}.json`;
        const filepath = path.join(cacheDir, filename);

        // Write atomically
        const tempPath = `${filepath}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(extraction, null, 2), 'utf8');
        await fs.rename(tempPath, filepath);

        this.logger.debug(`Cached extraction: ${extraction.id}`);
    }
}

module.exports = Phase2Extract;
