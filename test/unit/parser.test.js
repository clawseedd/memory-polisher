/**
 * Parser Module Tests
 */

const Parser = require('../../src/core/parser');

describe('Parser', () => {
    let parser;
    const mockConfig = {};
    const mockLogger = { debug: jest.fn() };

    beforeEach(() => {
        parser = new Parser(mockConfig, mockLogger);
    });

    describe('parseSections', () => {
        test('should parse sections by headers', async () => {
            const content = `# Title

## Section 1
Content 1

## Section 2
Content 2`;

            const sections = await parser.parseSections(content, 'test.md');

            expect(sections).toHaveLength(2);
            expect(sections[0].title).toBe('Section 1');
            expect(sections[1].title).toBe('Section 2');
        });

        test('should track line numbers', async () => {
            const content = `## First
Line 1
Line 2

## Second
Line 3`;

            const sections = await parser.parseSections(content, 'test.md');

            expect(sections[0].lineStart).toBe(0);
            expect(sections[0].lineEnd).toBe(2);
            expect(sections[1].lineStart).toBe(4);
        });

        test('should handle file without headers', async () => {
            const content = `Just some content
without headers`;

            const sections = await parser.parseSections(content, 'test.md');

            expect(sections).toHaveLength(1);
            expect(sections[0].title).toBe('test');
        });
    });

    describe('stripMarkdown', () => {
        test('should remove markdown formatting', () => {
            const content = `**Bold** and *italic* text
[Link](url) and \`code\``;

            const stripped = parser.stripMarkdown(content);

            expect(stripped).not.toContain('**');
            expect(stripped).not.toContain('*');
            expect(stripped).not.toContain('[');
            expect(stripped).not.toContain('`');
        });
    });

    describe('isValidMarkdown', () => {
        test('should validate correct markdown', () => {
            const content = `# Header\n\nParagraph\n\n- List item`;
            expect(parser.isValidMarkdown(content)).toBe(true);
        });
    });
});
