/**
 * Phase 3: Topic File Management
 * 
 * Responsibilities:
 * - Write primary entries to topic files
 * - Create cross-reference stubs
 * - Merge similar topics
 * 
 * SECURITY: Sanitizes topic names to prevent path traversal
 */

const fs = require('fs').promises;
const path = require('path');
const FileOps = require('../core/fileops');
const Transaction = require('../utils/transaction');

class Phase3Organize {
    constructor(config, logger, state) {
        this.config = config;
        this.logger = logger;
        this.state = state;
        this.fileops = new FileOps(config, logger);
        this.transaction = new Transaction(config, logger);
    }

    async execute() {
        const memoryDir = path.join(process.cwd(), 'memory');
        const topicsDir = path.join(memoryDir, this.config.advanced.topics_directory);

        await fs.mkdir(topicsDir, { recursive: true });

        this.logger.phase('Phase 3.1: Writing topic file entries');
        const primaryResult = await this.writePrimaryEntries(topicsDir);

        this.logger.phase('Phase 3.2: Creating cross-references');
        const crossRefResult = await this.createCrossReferences(topicsDir);

        this.logger.phase('Phase 3.3: Merging similar topics');
        const mergeResult = await this.mergeTopics(topicsDir);

        this.logger.info(`✓ Created/updated topic files with ${primaryResult.entriesWritten} entries`);
        this.logger.info(`✓ Created ${crossRefResult.stubsCreated} cross-references`);
        this.logger.info(`✓ Merged ${mergeResult.mergesCompleted} topic files`);

        return {
            entries_written: primaryResult.entriesWritten,
            cross_refs_created: crossRefResult.stubsCreated,
            merges_completed: mergeResult.mergesCompleted,
            topic_files_created: primaryResult.filesCreated
        };
    }

    /**
     * Sanitize topic name to prevent path traversal
     * SECURITY FIX: Removes dangerous characters and path components
     */
    sanitizeTopicName(topic) {
        // Remove path traversal attempts
        let sanitized = topic.replace(/\.\./g, '');
        sanitized = sanitized.replace(/[\/\\]/g, ''); // Remove slashes
        sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, ''); // Remove invalid filename chars

        // Ensure it's not empty after sanitization
        if (sanitized.length === 0) {
            sanitized = 'unnamed';
        }

        // Limit length
        if (sanitized.length > 100) {
            sanitized = sanitized.substring(0, 100);
        }

        return sanitized;
    }

    /**
     * Safely create topic file path
     * SECURITY: Validates resolved path is within topics directory
     */
    async getSafeTopicPath(topicsDir, topicName) {
        const sanitized = this.sanitizeTopicName(topicName);
        const capitalized = this.capitalizeFirst(sanitized);
        const filename = `${capitalized}.md`;
        const proposedPath = path.join(topicsDir, filename);

        // Resolve to absolute path
        const resolvedPath = path.resolve(proposedPath);
        const resolvedTopicsDir = path.resolve(topicsDir);

        // SECURITY: Ensure path is within topics directory
        if (!resolvedPath.startsWith(resolvedTopicsDir + path.sep)) {
            throw new Error(`Security violation: Topic path outside directory: ${topicName}`);
        }

        return resolvedPath;
    }

    async writePrimaryEntries(topicsDir) {
        const extractions = this.state.extractions || [];
        let entriesWritten = 0;
        const filesCreated = new Set();

        for (const extraction of extractions) {
            // SECURITY FIX: Sanitize topic name before file creation
            const topicPath = await this.getSafeTopicPath(topicsDir, extraction.primary_topic);
            const topicFile = path.basename(topicPath, '.md');

            let fileExists = false;
            try {
                await fs.access(topicPath);
                fileExists = true;
            } catch {
                // File doesn't exist
            }

            const entry = this.generateEntry(extraction);

            if (fileExists) {
                const existing = await fs.readFile(topicPath, 'utf8');
                const updated = existing + '\n' + entry;
                await this.fileops.writeAtomic(topicPath, updated);
            } else {
                const header = this.generateTopicHeader(extraction.primary_topic);
                const content = header + '\n' + entry;
                await this.fileops.writeAtomic(topicPath, content);
                filesCreated.add(topicFile);
            }

            await this.transaction.log({
                action: 'write_topic_entry',
                target: `Topics/${topicFile}.md`,
                section_id: extraction.id,
                status: 'success'
            });

            entriesWritten++;
        }

        return { entriesWritten, filesCreated: filesCreated.size };
    }

    async createCrossReferences(topicsDir) {
        const extractions = this.state.extractions || [];
        let stubsCreated = 0;

        for (const extraction of extractions) {
            if (extraction.secondary_topics.length === 0) {
                continue;
            }

            for (const secondaryTopic of extraction.secondary_topics) {
                // SECURITY FIX: Sanitize secondary topic names
                const topicPath = await this.getSafeTopicPath(topicsDir, secondaryTopic);

                const stub = this.generateStub(extraction, secondaryTopic);

                let fileExists = false;
                try {
                    await fs.access(topicPath);
                    fileExists = true;
                } catch {
                    // File doesn't exist
                }

                if (fileExists) {
                    const existing = await fs.readFile(topicPath, 'utf8');
                    const updated = existing + '\n' + stub;
                    await this.fileops.writeAtomic(topicPath, updated);
                } else {
                    const header = this.generateTopicHeader(secondaryTopic);
                    const content = header + '\n' + stub;
                    await this.fileops.writeAtomic(topicPath, content);
                }

                stubsCreated++;
            }
        }

        return { stubsCreated };
    }

    async mergeTopics(topicsDir) {
        const mergeProposals = this.state.merge_proposals || [];
        let mergesCompleted = 0;

        if (mergeProposals.length === 0) {
            return { mergesCompleted: 0 };
        }

        const archiveDir = path.join(topicsDir, '.archive');
        await fs.mkdir(archiveDir, { recursive: true });

        for (const proposal of mergeProposals) {
            const { canonical, alias } = proposal;

            // SECURITY FIX: Sanitize both canonical and alias names
            const aliasPath = await this.getSafeTopicPath(topicsDir, alias);
            const canonicalPath = await this.getSafeTopicPath(topicsDir, canonical);

            try {
                await fs.access(aliasPath);
            } catch {
                continue;
            }

            const aliasContent = await fs.readFile(aliasPath, 'utf8');
            const aliasEntries = this.parseEntries(aliasContent);

            let canonicalContent = '';
            try {
                canonicalContent = await fs.readFile(canonicalPath, 'utf8');
            } catch {
                canonicalContent = this.generateTopicHeader(canonical);
            }

            const existingHashes = this.extractHashes(canonicalContent);

            const entriesToMerge = aliasEntries.filter(entry => {
                const hash = this.extractHashFromEntry(entry);
                return hash && !existingHashes.includes(hash);
            });

            if (entriesToMerge.length === 0) {
                this.logger.debug(`No new entries to merge from ${alias}`);
                continue;
            }

            const updatedEntries = entriesToMerge.map(entry => {
                return entry.replace(new RegExp(`#${alias}\\b`, 'g'), `#${canonical}`);
            });

            const merged = canonicalContent + '\n' + updatedEntries.join('\n');
            await this.fileops.writeAtomic(canonicalPath, merged);

            const timestamp = new Date().toISOString().split('T')[0];
            const aliasFilename = path.basename(aliasPath, '.md');
            const archivePath = path.join(archiveDir, `${aliasFilename}_merged_${timestamp}.md`);

            const archiveHeader = `> ⚠️ **This file was merged into ${path.basename(canonicalPath)} on ${timestamp}**\n` +
                `> Reason: Topics #${alias} and #${canonical} were detected as similar\n` +
                `> Confidence: ${proposal.confidence.toFixed(2)}\n\n---\n\n`;

            await fs.writeFile(archivePath, archiveHeader + aliasContent, 'utf8');
            await fs.unlink(aliasPath);

            await this.transaction.log({
                action: 'merge_topic_file',
                source: alias,
                target: canonical,
                entries_merged: entriesToMerge.length,
                status: 'success'
            });

            mergesCompleted++;
            this.logger.info(`  ✓ Merged ${aliasFilename}.md → ${path.basename(canonicalPath, '.md')}.md (${entriesToMerge.length} entries)`);
        }

        return { mergesCompleted };
    }

    generateTopicHeader(topic) {
        const sanitized = this.sanitizeTopicName(topic);
        const today = new Date().toISOString().split('T')[0];
        return `# ${this.capitalizeFirst(sanitized)}\n\n` +
            `> Auto-curated notes from daily logs\n` +
            `> Topic: #${sanitized}\n` +
            `> Last polished: ${today}\n\n` +
            `---\n`;
    }

    generateEntry(extraction) {
        const date = this.extractDateFromFile(extraction.source_file);
        const line = extraction.source_line_start;

        const secondaryTags = extraction.secondary_topics.length > 0
            ? ' #' + extraction.secondary_topics.map(t => this.sanitizeTopicName(t)).join(' #')
            : '';

        return `### ${date} — [${extraction.source_file}](../${extraction.source_file}#L${line})\n\n` +
            `${extraction.full_content}\n\n` +
            `**Topics:** #${this.sanitizeTopicName(extraction.primary_topic)}${secondaryTags}\n` +
            `**Source:** ${extraction.source_file} (lines ${extraction.source_line_start}-${extraction.source_line_end})\n` +
            `**Hash:** ${extraction.content_hash}\n\n` +
            `---\n`;
    }

    generateStub(extraction, secondaryTopic) {
        const date = this.extractDateFromFile(extraction.source_file);
        const primaryFile = this.capitalizeFirst(this.sanitizeTopicName(extraction.primary_topic));
        const preview = extraction.full_content.substring(0, 100).replace(/\n/g, ' ');

        const allTags = [extraction.primary_topic, ...extraction.secondary_topics]
            .map(t => `#${this.sanitizeTopicName(t)}`)
            .join(' ');

        return `### ${date} — Cross-Reference\n\n` +
            `📌 **Full entry:** [Topics/${primaryFile}.md](../${primaryFile}.md#${date})\n\n` +
            `**Preview:** ${preview}...\n\n` +
            `**Tags:** ${allTags}\n` +
            `**Related File:** ${extraction.source_file}\n\n` +
            `---\n`;
    }

    parseEntries(content) {
        const parts = content.split(/\n---\n/);
        return parts.filter(part => {
            return part.trim().length > 0 &&
                !part.startsWith('# ') &&
                !part.startsWith('> ');
        });
    }

    extractHashes(content) {
        const hashPattern = /\*\*Hash:\*\* ([a-f0-9]{64})/g;
        const hashes = [];
        let match;

        while ((match = hashPattern.exec(content)) !== null) {
            hashes.push(match[1]);
        }

        return hashes;
    }

    extractHashFromEntry(entry) {
        const match = entry.match(/\*\*Hash:\*\* ([a-f0-9]{64})/);
        return match ? match[1] : null;
    }

    extractDateFromFile(filename) {
        const match = filename.match(/memory-(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : 'unknown';
    }

    capitalizeFirst(str) {
        if (!str || str.length === 0) return 'Unnamed';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

module.exports = Phase3Organize;
