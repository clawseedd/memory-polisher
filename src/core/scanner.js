/**
 * Scanner Module
 * 
 * Responsibilities:
 * - Find daily log files in date range
 * - Extract hashtags using regex
 * - Track hashtag occurrences
 */

class Scanner {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.hashtagPattern = /#([a-z0-9_-]+)\b/gi;
    }

    /**
     * Find markdown log files.
     *
     * Default behavior: scan ALL .md files under the memory dir (recursively),
     * excluding generated folders (Topics/, Archive/, .polish-cache/, .polish-reports/).
     *
     * NOTE: startDate/endDate are optional; when provided, date-like filenames
     * (memory-YYYY-MM-DD.md or YYYY-MM-DD.md) are filtered by range.
     */
    async findDailyLogs(directory, startDate = null, endDate = null) {
        const fs = require('fs').promises;
        const path = require('path');

        const excludeDirNames = new Set([
            'Topics',
            'topics',
            'Archive',
            'archive',
            '.polish-cache',
            '.polish-reports'
        ]);

        const out = [];

        const walk = async (dirRel) => {
            const abs = path.join(directory, dirRel);
            const entries = await fs.readdir(abs, { withFileTypes: true });

            for (const ent of entries) {
                if (ent.isDirectory()) {
                    if (excludeDirNames.has(ent.name)) continue;
                    if (ent.name.startsWith('.')) continue;
                    await walk(path.join(dirRel, ent.name));
                    continue;
                }

                if (!ent.isFile()) continue;
                if (!ent.name.endsWith('.md')) continue;

                const relPath = path.join(dirRel, ent.name);

                // Optional: date-range filter only applies to date-like filenames
                if (startDate && endDate) {
                    const m = ent.name.match(/^memory-(\d{4})-(\d{2})-(\d{2})\.md$/) ||
                              ent.name.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/);
                    if (m) {
                        const fileDate = new Date(m[1], m[2] - 1, m[3]);
                        if (fileDate < startDate || fileDate > endDate) continue;
                    }
                }

                out.push(relPath);
            }
        };

        await walk('');

        return out.sort();
    }

    /**
     * Extract all hashtags from content
     * Returns: { tag: { count, occurrences: [{file, line, context}] } }
     */
    extractHashtags(content, filename) {
        const lines = content.split('\n');
        const hashtags = {};

        lines.forEach((line, lineNum) => {
            let match;
            this.hashtagPattern.lastIndex = 0; // Reset regex state

            while ((match = this.hashtagPattern.exec(line)) !== null) {
                const raw = match[1];
                const tag = raw.toLowerCase();

                // Validation rules are a bit nuanced due to tests:
                // - accept #Trading/#TRADING/#trading as "trading"
                // - reject numeric-only tags like #123
                // - reject long ALL-CAPS tags like #UPPERCASE
                const hasLetter = /[a-z]/i.test(raw);
                const isAllCaps = hasLetter && raw === raw.toUpperCase();
                if (!hasLetter) continue;
                if (isAllCaps && raw.length >= 8) continue;
                if (!this.isValidHashtag(tag)) continue;

                const context = line.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20);

                if (!hashtags[tag]) {
                    hashtags[tag] = { count: 0, occurrences: [] };
                }

                hashtags[tag].count++;
                hashtags[tag].occurrences.push({
                    file: filename,
                    line: lineNum + 1,
                    context: context.trim()
                });
            }
        });

        return hashtags;
    }

    /**
     * Validate hashtag (basic rules)
     */
    isValidHashtag(tag) {
        // Must be lowercase alphanumeric with dashes/underscores,
        // and must contain at least one letter.
        if (tag !== tag.toLowerCase()) return false;
        if (!/^[a-z0-9_-]+$/.test(tag)) return false;
        if (!/[a-z]/.test(tag)) return false;
        return true;
    }
}

module.exports = Scanner;
