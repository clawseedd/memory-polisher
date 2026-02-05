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
     * Find daily log files within date range
     */
    async findDailyLogs(directory, startDate, endDate) {
        const fs = require('fs').promises;
        const files = await fs.readdir(directory);

        const pattern = /^memory-(\d{4})-(\d{2})-(\d{2})\.md$/;

        return files.filter(file => {
            const match = file.match(pattern);
            if (!match) return false;

            const fileDate = new Date(match[1], match[2] - 1, match[3]);
            return fileDate >= startDate && fileDate <= endDate;
        }).sort();
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
                const tag = match[1].toLowerCase();
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
        // Must be lowercase alphanumeric with dashes/underscores
        return /^[a-z0-9_-]+$/.test(tag);
    }
}

module.exports = Scanner;
