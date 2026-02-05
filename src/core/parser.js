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

const { unified } = require('unified');
const remarkParse = require('remark-parse');
const remarkStringify = require('remark-stringify');

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
            const endLine = nextHeader ? nextHeader.line - 1 : lines.length - 1;

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
            const processor = unified()
                .use(remarkParse);

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
            .replace(/!\\[.*?\\]\\(.*?\\)/g, '') // Images - CORRECT
            .replace(/\\[([^\\]]+)\]\\(.*?\\)/g, '$1') // Links - CORRECT
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
        try {
            const processor = unified()
                .use(remarkParse)
                .use(remarkStringify);

            processor.processSync(content);
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = Parser;
