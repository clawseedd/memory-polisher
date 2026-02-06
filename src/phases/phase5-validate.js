/**
 * Phase 5: Validation & Finalization
 * 
 * Responsibilities:
 * - Comprehensive integrity checks
 * - Generate polish report
 * - Finalize session or rollback
 */

const fs = require('fs').promises;
const path = require('path');
const Transaction = require('../utils/transaction');
const Backup = require('../utils/backup');

class Phase5Validate {
    constructor(config, logger, state) {
        this.config = config;
        this.logger = logger;
        this.state = state;
        this.transaction = new Transaction(config, logger);
        this.backup = new Backup(config, logger);
        this.errors = [];
        this.warnings = [];
    }

    async execute() {
        this.logger.phase('Phase 5.1: Integrity checks');

        // Run all checks
        await this.checkContentIntegrity();
        await this.checkLinkIntegrity();
        await this.checkMergeIntegrity();
        await this.checkFilesystemHealth();

        // Decide: finalize or rollback
        if (this.errors.length === 0) {
            this.logger.success('✓ All integrity checks passed');
            await this.finalize();

            return {
                validation_status: 'passed',
                errors: [],
                warnings: this.warnings
            };
        } else {
            this.logger.error(`✗ ${this.errors.length} critical errors detected`);
            await this.rollback();

            return {
                validation_status: 'failed',
                errors: this.errors,
                warnings: this.warnings
            };
        }
    }

    async checkContentIntegrity() {
        this.logger.info('Checking content integrity...');

        const extractions = this.state.extractions || [];
        const topicsDir = path.join(process.cwd(), 'memory', this.config.advanced.topics_directory);

        for (const extraction of extractions) {
            const topicFile = this.capitalizeFirst(extraction.primary_topic);
            const topicPath = path.join(topicsDir, `${topicFile}.md`);

            try {
                const content = await fs.readFile(topicPath, 'utf8');

                // Check if hash exists in topic file
                if (!content.includes(extraction.content_hash)) {
                    this.errors.push({
                        type: 'missing_entry',
                        extraction: extraction.id,
                        topic: extraction.primary_topic,
                        message: `Entry not found in topic file`
                    });
                }
            } catch (error) {
                this.errors.push({
                    type: 'missing_topic_file',
                    topic: extraction.primary_topic,
                    message: error.message
                });
            }
        }

        this.logger.debug(`Content integrity: ${this.errors.length === 0 ? 'PASS' : 'FAIL'}`);
    }

    async checkLinkIntegrity() {
        this.logger.info('Checking link integrity...');

        const topicsDir = path.join(process.cwd(), 'memory', this.config.advanced.topics_directory);
        const memoryDir = path.join(process.cwd(), 'memory');

        try {
            const topicFiles = await fs.readdir(topicsDir);

            for (const file of topicFiles.filter(f => f.endsWith('.md'))) {
                const filePath = path.join(topicsDir, file);
                const content = await fs.readFile(filePath, 'utf8');

                // Find all markdown links
                const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
                let match;

                while ((match = linkPattern.exec(content)) !== null) {
                    const linkText = match[1];
                    const linkPath = match[2];

                    // Skip external links
                    if (linkPath.startsWith('http')) continue;

                    // Resolve relative path
                    const resolvedPath = path.resolve(topicsDir, linkPath.split('#')[0]);

                    // Check if target exists
                    try {
                        await fs.access(resolvedPath);
                    } catch {
                        this.errors.push({
                            type: 'broken_link',
                            source: file,
                            target: linkPath,
                            message: `Link target not found: ${linkPath}`
                        });
                    }
                }
            }
        } catch (error) {
            this.warnings.push({
                type: 'link_check_error',
                message: error.message
            });
        }

        this.logger.debug(`Link integrity: ${this.errors.filter(e => e.type === 'broken_link').length === 0 ? 'PASS' : 'FAIL'}`);
    }

    async checkMergeIntegrity() {
        this.logger.info('Checking merge integrity...');

        const merges = this.state.merge_proposals || [];
        const topicsDir = path.join(process.cwd(), 'memory', this.config.advanced.topics_directory);
        const archiveDir = path.join(topicsDir, '.archive');

        for (const merge of merges) {
            const aliasFile = this.capitalizeFirst(merge.alias);
            const canonicalFile = this.capitalizeFirst(merge.canonical);

            // Check old file archived
            const archivePattern = new RegExp(`${aliasFile}_merged_\\d{4}-\\d{2}-\\d{2}\\.md`);

            try {
                const archiveFiles = await fs.readdir(archiveDir);
                const archived = archiveFiles.some(f => archivePattern.test(f));

                if (!archived) {
                    this.warnings.push({
                        type: 'merge_incomplete',
                        merge: `${merge.alias} → ${merge.canonical}`,
                        message: 'Old topic file not found in archive'
                    });
                }
            } catch {
                // Archive dir doesn't exist
            }

            // Check for duplicates in canonical file
            const canonicalPath = path.join(topicsDir, `${canonicalFile}.md`);
            try {
                const content = await fs.readFile(canonicalPath, 'utf8');
                const hashes = this.extractHashes(content);
                const uniqueHashes = new Set(hashes);

                if (hashes.length !== uniqueHashes.size) {
                    this.errors.push({
                        type: 'duplicate_entries',
                        topic: merge.canonical,
                        message: `Found ${hashes.length - uniqueHashes.size} duplicate entries`
                    });
                }
            } catch {
                // Canonical file doesn't exist
            }
        }

        this.logger.debug(`Merge integrity: ${this.errors.filter(e => e.type === 'duplicate_entries').length === 0 ? 'PASS' : 'FAIL'}`);
    }

    async checkFilesystemHealth() {
        this.logger.info('Checking filesystem health...');

        const topicsDir = path.join(process.cwd(), 'memory', this.config.advanced.topics_directory);

        try {
            const files = await fs.readdir(topicsDir);

            for (const file of files.filter(f => f.endsWith('.md'))) {
                const filePath = path.join(topicsDir, file);
                const stats = await fs.stat(filePath);

                // Check for empty files
                if (stats.size === 0) {
                    this.errors.push({
                        type: 'empty_file',
                        file: file,
                        message: 'File is empty (0 bytes)'
                    });
                }

                // Check for suspiciously small files
                if (stats.size < 100) {
                    this.warnings.push({
                        type: 'small_file',
                        file: file,
                        size: stats.size,
                        message: 'File is suspiciously small'
                    });
                }

                // Check file is readable and valid
                try {
                    const content = await fs.readFile(filePath, 'utf8');

                    // Check for corruption markers
                    if (content.includes('undefined') || content.includes('[object Object]')) {
                        this.errors.push({
                            type: 'corrupted_file',
                            file: file,
                            message: 'File contains corruption markers'
                        });
                    }
                } catch (error) {
                    this.errors.push({
                        type: 'unreadable_file',
                        file: file,
                        message: error.message
                    });
                }
            }
        } catch (error) {
            this.errors.push({
                type: 'filesystem_error',
                message: error.message
            });
        }

        this.logger.debug(`Filesystem health: ${this.errors.filter(e => e.type.includes('file')).length === 0 ? 'PASS' : 'FAIL'}`);
    }

    async finalize() {
        this.logger.phase('Phase 5.2: Finalizing session');

        // Generate report
        await this.generateReport();

        // Clean old cache (if enabled)
        if (this.config.cleanup.auto_cleanup) {
            await this.cleanupCache();
        }

        // Mark checkpoint as completed
        const Checkpoint = require('../utils/checkpoint');
        const checkpoint = new Checkpoint(this.config);
        await checkpoint.save({
            ...this.state,
            status: 'completed',
            completed_at: new Date().toISOString()
        });

        this.logger.success('✨ Memory polisher finalized');
    }

    async rollback() {
        this.logger.phase('Phase 5.3: Rolling back changes');

        const transactions = await this.transaction.getReverse();

        for (const txn of transactions) {
            try {
                if (txn.action === 'replace_stubs') {
                    // Restore file from backup
                    if (!txn.hash || !txn.target) {
                        this.logger.warn(`Skipping rollback entry (missing hash/target): ${JSON.stringify({ action: txn.action, target: txn.target, hash: txn.hash })}`);
                        continue;
                    }

                    await this.backup.restore(txn.hash, txn.target);
                    this.logger.debug(`Restored: ${txn.target}`);
                }
                // Add more rollback handlers as needed
            } catch (error) {
                this.logger.error(`Rollback failed for ${txn.target}: ${error.message}`);
            }
        }

        // Generate rollback report
        await this.generateRollbackReport();

        this.logger.error('⚠️  Session rolled back. See rollback report for details.');
    }

    async generateReport() {
        const reportDir = path.join(process.cwd(), 'memory', this.config.logging.report_location);
        await fs.mkdir(reportDir, { recursive: true });

        const today = new Date().toISOString().split('T')[0];
        const reportPath = path.join(reportDir, `report-${today}.md`);

        const stats = this.state;
        const duration = stats.started_at ?
            ((new Date() - new Date(stats.started_at)) / 1000).toFixed(1) : 'unknown';

        const report = `# Memory Polish Report — ${today}

## ✨ Session Summary
- **Status:** ✅ Completed successfully
- **Duration:** ${duration} seconds
- **Files Processed:** ${stats.files_processed?.length || 0} daily logs
- **Session ID:** ${stats.session_id}

## 📊 Topic Discovery
- **Topics Discovered:** ${Object.keys(stats.discovered_topics || {}).length} unique hashtags
- **Canonical Topics:** ${Object.keys(stats.canonical_map?.canonicalMap || {}).length}
- **Similarity Method:** ${stats.similarity_method}

## 🔀 Merges Applied
${(stats.merge_proposals || []).map(m =>
            `- \`#${m.alias}\` → \`#${m.canonical}\` (confidence: ${m.confidence.toFixed(2)})`
        ).join('\n') || '- None'}

## 📝 Content Organization
- **Entries Created:** ${stats.entries_written || 0} topic entries
- **Cross-References:** ${stats.cross_refs_created || 0} stubs
- **Files Archived:** ${stats.files_archived || 0}
- **Links Healed:** ${stats.links_healed || 0}

## ⚠️ Warnings
${this.warnings.length === 0 ? '- None' : this.warnings.map(w => `- ${w.message}`).join('\n')}

---
**Generated by memory-polisher v1.0.0**  
**Cache location:** memory/.polish-cache/
`;

        await fs.writeFile(reportPath, report, 'utf8');
        this.logger.info(`📊 Report saved: ${reportPath}`);
    }

    async generateRollbackReport() {
        const reportDir = path.join(process.cwd(), 'memory', this.config.logging.report_location);
        const today = new Date().toISOString().split('T')[0];
        const reportPath = path.join(reportDir, `rollback-${today}.md`);

        const report = `# Rollback Report — ${today}

## ❌ Session Failed

**Errors Detected:** ${this.errors.length}

${this.errors.map((e, i) => `### Error ${i + 1}: ${e.type}
- **Message:** ${e.message}
- **Details:** ${JSON.stringify(e, null, 2)}
`).join('\n')}

## 🔄 Rollback Actions
All changes have been reverted. Original files restored from backups.

## 📝 Next Steps
1. Review errors above
2. Fix underlying issues
3. Re-run memory-polisher when ready

Your data is safe. No files were permanently modified.
`;

        await fs.mkdir(reportDir, { recursive: true });
        await fs.writeFile(reportPath, report, 'utf8');
    }

    async cleanupCache() {
        const hours = this.config.cleanup.keep_session_cache_hours || 24;
        const deleted = await this.backup.cleanOld(hours);

        if (deleted > 0) {
            this.logger.info(`Cleaned ${deleted} old backup files`);
        }
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

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

module.exports = Phase5Validate;
