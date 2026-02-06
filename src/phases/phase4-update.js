/**
 * Phase 4: Daily Log Updates
 * 
 * Responsibilities:
 * - Replace extracted sections with stubs
 * - Archive old files
 * - Heal links in topic files
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const FileOps = require('../core/fileops');
const Transaction = require('../utils/transaction');
const Backup = require('../utils/backup');

class Phase4Update {
    constructor(config, logger, state) {
        this.config = config;
        this.logger = logger;
        this.state = state;
        this.fileops = new FileOps(config, logger);
        this.transaction = new Transaction(config, logger);
        this.backup = new Backup(config, logger);
    }

    async execute() {
        const memoryDir = path.join(process.cwd(), 'memory');

        // Step 4.1: Replace sections with stubs
        this.logger.phase('Phase 4.1: Replacing sections with stubs');
        const stubResult = await this.replaceWithStubs(memoryDir);

        // Step 4.2: Archive old files (if enabled)
        if (this.config.archive.enabled) {
            this.logger.phase('Phase 4.2: Archiving old files & healing links');
            const archiveResult = await this.archiveFiles(memoryDir);

            // Heal links after archiving
            const healResult = await this.healLinks(memoryDir);

            this.logger.info(`✓ Archived ${archiveResult.filesArchived} files`);
            this.logger.info(`✓ Healed ${healResult.linksHealed} links in ${healResult.filesUpdated} topic files`);

            return {
                files_modified: stubResult.filesModified,
                stubs_created: stubResult.stubsCreated,
                files_archived: archiveResult.filesArchived,
                links_healed: healResult.linksHealed
            };
        }

        this.logger.info(`✓ Updated ${stubResult.filesModified} daily logs with stubs`);

        return {
            files_modified: stubResult.filesModified,
            stubs_created: stubResult.stubsCreated,
            files_archived: 0,
            links_healed: 0
        };
    }

    async replaceWithStubs(memoryDir) {
        const extractions = this.state.extractions || [];

        // Group extractions by source file
        const fileGroups = {};
        for (const extraction of extractions) {
            if (!fileGroups[extraction.source_file]) {
                fileGroups[extraction.source_file] = [];
            }
            fileGroups[extraction.source_file].push(extraction);
        }

        let filesModified = 0;
        let stubsCreated = 0;

        for (const [filename, fileExtractions] of Object.entries(fileGroups)) {
            const filePath = path.join(memoryDir, filename);

            // Read original file
            let content = await fs.readFile(filePath, 'utf8');

            // Ensure we have a rollback backup for this file and record the hash in the transaction.
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            await this.backup.create(filePath, content, hash);
            const lines = content.split('\n');

            // Sort extractions by line number (reverse order for bottom-up replacement)
            fileExtractions.sort((a, b) => b.source_line_start - a.source_line_start);

            // Replace each section with stub
            for (const extraction of fileExtractions) {
                const stub = this.generateDailyLogStub(extraction);

                // Replace lines
                const beforeLines = lines.slice(0, extraction.source_line_start);
                const afterLines = lines.slice(extraction.source_line_end + 1);
                const newLines = [...beforeLines, ...stub.split('\n'), ...afterLines];

                lines.length = 0;
                lines.push(...newLines);
                stubsCreated++;
            }

            // Reconstruct content
            const newContent = lines.join('\n');

            // Verify new content
            const originalSize = content.length;
            const newSize = newContent.length;
            const reduction = (originalSize - newSize) / originalSize;

            if (newSize === 0 || reduction > 0.95) {
                this.logger.error(`Suspicious size reduction for ${filename}: ${(reduction * 100).toFixed(1)}%`);
                throw new Error(`Stub replacement validation failed for ${filename}`);
            }

            // Write atomically
            await this.fileops.writeAtomic(filePath, newContent);

            // Log transaction
            await this.transaction.log({
                action: 'replace_stubs',
                target: filePath,
                hash,
                stubs_created: fileExtractions.length,
                status: 'success'
            });

            filesModified++;
            this.logger.debug(`Updated ${filename} with ${fileExtractions.length} stubs`);
        }

        return { filesModified, stubsCreated };
    }

    async archiveFiles(memoryDir) {
        const gracePeriod = this.config.archive.grace_period_days || 3;
        const today = new Date();
        const cutoffDate = new Date(today);
        cutoffDate.setDate(today.getDate() - gracePeriod);

        // Get list of files to archive
        const files = await fs.readdir(memoryDir);
        const pattern = /^memory-(\d{4})-(\d{2})-(\d{2})\.md$/;

        const filesToArchive = files.filter(file => {
            const match = file.match(pattern);
            if (!match) return false;

            const fileDate = new Date(match[1], match[2] - 1, match[3]);
            return fileDate < cutoffDate;
        });

        if (filesToArchive.length === 0) {
            return { filesArchived: 0 };
        }

        // Create archive directory
        const year = today.getFullYear();
        const archiveDir = path.join(memoryDir, this.config.advanced.archive_directory, year.toString());
        await fs.mkdir(archiveDir, { recursive: true });

        let filesArchived = 0;

        for (const file of filesToArchive) {
            const sourcePath = path.join(memoryDir, file);
            const destPath = path.join(archiveDir, file);

            // Check if destination already exists
            try {
                await fs.access(destPath);
                // File exists, check if identical
                const sourceContent = await fs.readFile(sourcePath, 'utf8');
                const destContent = await fs.readFile(destPath, 'utf8');

                if (sourceContent === destContent) {
                    // Identical, safe to delete source
                    await fs.unlink(sourcePath);
                    this.logger.debug(`Already archived: ${file}`);
                    filesArchived++;
                    continue;
                } else {
                    // Different content, rename with timestamp
                    const timestamp = new Date().getTime();
                    const newName = file.replace('.md', `_conflict_${timestamp}.md`);
                    await fs.rename(sourcePath, path.join(archiveDir, newName));
                    this.logger.warn(`Archived with conflict rename: ${newName}`);
                    filesArchived++;
                    continue;
                }
            } catch {
                // Destination doesn't exist, proceed with move
            }

            // Move file atomically
            try {
                await fs.rename(sourcePath, destPath);
            } catch (error) {
                // Cross-filesystem move, copy then delete
                const content = await fs.readFile(sourcePath, 'utf8');
                await fs.writeFile(destPath, content, 'utf8');

                // Verify copy
                const copiedContent = await fs.readFile(destPath, 'utf8');
                if (content === copiedContent) {
                    await fs.unlink(sourcePath);
                } else {
                    throw new Error(`Archive verification failed for ${file}`);
                }
            }

            // Log transaction
            await this.transaction.log({
                action: 'archive',
                source: file,
                destination: `Archive/${year}/${file}`,
                status: 'success'
            });

            filesArchived++;
        }

        return { filesArchived, archivedFiles: filesToArchive };
    }

    async healLinks(memoryDir) {
        const topicsDir = path.join(memoryDir, this.config.advanced.topics_directory);
        const archiveDir = path.join(memoryDir, this.config.advanced.archive_directory);

        // Get archived files from previous step
        const archivedFiles = this.state.archivedFiles || [];

        // Always heal known-bad link patterns inside Topics (even if nothing was archived)
        const topicLinkHeal = await this.healTopicLinks(topicsDir);

        if (archivedFiles.length === 0) {
            return { linksHealed: topicLinkHeal.linksHealed, filesUpdated: topicLinkHeal.filesUpdated };
        }

        // Get all topic files
        const topicFiles = await fs.readdir(topicsDir);
        const mdFiles = topicFiles.filter(f => f.endsWith('.md'));

        let totalLinksHealed = 0;
        let filesUpdated = 0;
        const year = new Date().getFullYear();

        for (const topicFile of mdFiles) {
            const topicPath = path.join(topicsDir, topicFile);
            let content = await fs.readFile(topicPath, 'utf8');
            let modified = false;
            let linksHealed = 0;

            // Update links for each archived file
            for (const archivedFile of archivedFiles) {
                // Pattern: [filename](../filename) or [filename](../filename#L123)
                const pattern = new RegExp(
                    `\\\[${archivedFile}\\\]\\\(\\.\\.\/${archivedFile}(#[^)]*)?\\\)`,
                    'g'
                );

                const newPath = `../Archive/${year}/${archivedFile}`;
                const replacement = `[${archivedFile}](${newPath}$1)`;

                const beforeCount = (content.match(pattern) || []).length;
                content = content.replace(pattern, replacement);
                const afterCount = (content.match(new RegExp(newPath.replace(/\//g, '\\/'), 'g')) || []).length;

                if (afterCount > beforeCount - afterCount) {
                    modified = true;
                    linksHealed += (afterCount - (beforeCount - afterCount));
                }
            }

            if (modified) {
                await this.fileops.writeAtomic(topicPath, content);
                totalLinksHealed += linksHealed;
                filesUpdated++;
                this.logger.debug(`Healed ${linksHealed} links in ${topicFile}`);
            }
        }

        return { linksHealed: totalLinksHealed, filesUpdated };
    }

    async healTopicLinks(topicsDir) {
        // Fix legacy cross-topic links created by older versions:
        // - ../Topic.md#unknown
        // - ../Topic.md
        // - Topics/Topic.md#unknown
        // - Topics/Topic.md
        // Within Topics directory, correct form should be: Topic.md (anchor optional)
        let linksHealed = 0;
        let filesUpdated = 0;

        let topicFiles = [];
        try {
            topicFiles = (await fs.readdir(topicsDir)).filter(f => f.endsWith('.md'));
        } catch {
            return { linksHealed: 0, filesUpdated: 0 };
        }

        for (const file of topicFiles) {
            const filePath = path.join(topicsDir, file);
            let content = await fs.readFile(filePath, 'utf8');
            const before = content;

            // Remove #unknown anchors everywhere inside Topics
            content = content.replace(/\]\(([^)]+)#unknown\)/g, ']($1)');

            // Rewrite cross-topic links that incorrectly point outside Topics
            // Only rewrite for links that look like a single markdown file name (no slashes other than ../ or Topics/)
            content = content.replace(/\]\(\.\.\/([A-Za-z0-9_-]+\.md)\)/g, ']($1)');
            content = content.replace(/\]\(Topics\/([A-Za-z0-9_-]+\.md)\)/g, ']($1)');

            if (content !== before) {
                await this.fileops.writeAtomic(filePath, content);
                filesUpdated++;
                // best-effort count
                linksHealed += (before.match(/#unknown\)/g) || []).length;
                linksHealed += (before.match(/\]\(\.\.\/[A-Za-z0-9_-]+\.md\)/g) || []).length;
                linksHealed += (before.match(/\]\(Topics\/[A-Za-z0-9_-]+\.md\)/g) || []).length;
            }
        }

        return { linksHealed, filesUpdated };
    }

    generateDailyLogStub(extraction) {
        const topicFile = this.capitalizeFirst(extraction.primary_topic);
        const date = this.extractDateFromFile(extraction.source_file);

        const anchor = date !== 'unknown' ? `#${date}` : '';

        if (extraction.secondary_topics.length === 0) {
            // Single-topic stub
            return `## ${extraction.section_title}\n` +
                `→ **Polished to [Topics/${topicFile}.md](Topics/${topicFile}.md${anchor})** on ${new Date().toISOString().split('T')[0]}`;
        } else {
            // Multi-topic stub
            const secondaryLinks = extraction.secondary_topics
                .map(topic => {
                    const file = this.capitalizeFirst(topic);
                    return `[Topics/${file}.md](Topics/${file}.md${anchor})`;
                })
                .join(', ');

            const allTags = [extraction.primary_topic, ...extraction.secondary_topics]
                .map(t => `#${t}`)
                .join(' ');

            return `## ${extraction.section_title}\n` +
                `→ **Primary:** [Topics/${topicFile}.md](Topics/${topicFile}.md${anchor})\n` +
                `→ **Also in:** ${secondaryLinks}\n\n` +
                `📎 Topics: ${allTags}`;
        }
    }

    extractDateFromFile(filename) {
        const match = filename.match(/memory-(\d{4}-\d{2}-\d{2})/) || filename.match(/(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : 'unknown';
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

module.exports = Phase4Update;
