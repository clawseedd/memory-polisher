/**
 * Parser Module
 * 
 * Responsibilities:
 * - Parse markdown into sections
 * - Extract headers and content
 * - Track line numbers for reference
 * 
 * FIX: Corrected regex patterns for markdown stripping
 */

// NOTE: unified/remark packages are ESM in modern versions.
// To keep this codebase CommonJS-friendly (and Jest-friendly), we lazy-load via dynamic import
// inside the few methods that need it.

class Parser {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    /**
     * Parse markdown content into sections
     * Returns: Array of { index, title, level, lineStart, lineEnd, content }
     */
    async parseSections(content, filename) {
        const lines = content.split('\n');
        const sections = [];

        // Find all headers
        const headers = [];
        lines.forEach((line, index) => {
            const match = line.match(/^(#{2,})\s+(.+)$/);
            if (match) {
                headers.push({
                    line: index,
                    level: match[1].length,
                    title: match[2].trim()
                });
            }
        });

        // Extract sections between headers
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            const nextHeader = headers[i + 1];

            const startLine = header.line;
            let endLine = nextHeader ? nextHeader.line - 1 : lines.length - 1;

            // Trim trailing blank lines from the section to match test expectations
            while (endLine > startLine && lines[endLine].trim() === '') {
                endLine--;
            }

            const sectionLines = lines.slice(startLine, endLine + 1);
            const sectionContent = sectionLines.join('\n').trim();

            if (sectionContent.length === 0) continue;

            sections.push({
                index: i,
                title: header.title,
                level: header.level,
                lineStart: startLine,
                lineEnd: endLine,
                content: sectionContent
            });
        }

        // If no headers found, treat entire file as one section
        if (sections.length === 0 && content.trim().length > 0) {
            sections.push({
                index: 0,
                title: filename.replace('.md', ''),
                level: 2,
                lineStart: 0,
                lineEnd: lines.length - 1,
                content: content.trim()
            });
        }

        return sections;
    }

    /**
     * Parse markdown using unified/remark (alternative method)
     */
    async parseMarkdownAST(content) {
        try {
            const { unified } = await import('unified');
            const remarkParse = (await import('remark-parse')).default;

            const processor = unified().use(remarkParse);
            const tree = processor.parse(content);
            return tree;
        } catch (error) {
            this.logger.warn(`AST parsing failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract text content from markdown (strip formatting)
     * FIX: Corrected regex - no double backslashes needed in regex literals
     */
    stripMarkdown(content) {
        return content
            .replace(/!\[.*?\]\(.*?\)/g, '') // Images
            .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // Links
            .replace(/`{1,3}[^`]*`{1,3}/g, '') // Code blocks
            .replace(/[*_~]/g, '') // Bold/italic/strikethrough
            .replace(/^#+\s+/gm, '') // Headers
            .replace(/^\s*[-*+]\s+/gm, '') // Lists
            .trim();
    }

    /**
     * Validate markdown syntax
     */
    isValidMarkdown(content) {
        // Lightweight validation (kept synchronous for tests).
        // We avoid depending on ESM-only markdown parsers in a CommonJS/Jest environment.
        if (typeof content !== 'string') return false;

        // Very basic check for obviously-unclosed markdown link syntax like: [text](url
        const hasUnclosedLink = /\[[^\]]*\]\([^)]*$/.test(content);
        if (hasUnclosedLink) return false;

        return true;
    }
}

module.exports = Parser;
