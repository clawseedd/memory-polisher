/**
 * Scanner Unit Tests
 */

const Scanner = require('../../src/core/scanner');

describe('Scanner', () => {
    let scanner;
    const mockConfig = {
        advanced: { min_tag_frequency: 2 }
    };
    const mockLogger = {
        debug: jest.fn(),
        info: jest.fn()
    };

    beforeEach(() => {
        scanner = new Scanner(mockConfig, mockLogger);
    });

    describe('extractHashtags', () => {
        test('should extract hashtags from content', () => {
            const content = `## Trading Idea
#trading #python

Some content here #ai`;

            const hashtags = scanner.extractHashtags(content, 'test.md');

            expect(hashtags).toHaveProperty('trading');
            expect(hashtags).toHaveProperty('python');
            expect(hashtags).toHaveProperty('ai');
            expect(hashtags.trading.count).toBe(1);
        });

        test('should handle multiple occurrences', () => {
            const content = `#trading
      
## Section
#trading again

More #trading`;

            const hashtags = scanner.extractHashtags(content, 'test.md');

            expect(hashtags.trading.count).toBe(3);
            expect(hashtags.trading.occurrences).toHaveLength(3);
        });

        test('should ignore invalid hashtags', () => {
            const content = `#123 #UPPERCASE # nohashtag`;

            const hashtags = scanner.extractHashtags(content, 'test.md');

            expect(Object.keys(hashtags)).toHaveLength(0);
        });

        test('should lowercase hashtags', () => {
            const content = `#Trading #TRADING #trading`;

            const hashtags = scanner.extractHashtags(content, 'test.md');

            expect(hashtags).toHaveProperty('trading');
            expect(hashtags.trading.count).toBe(3);
        });
    });

    describe('isValidHashtag', () => {
        test('should validate correct hashtags', () => {
            expect(scanner.isValidHashtag('trading')).toBe(true);
            expect(scanner.isValidHashtag('python-3')).toBe(true);
            expect(scanner.isValidHashtag('my_tag')).toBe(true);
        });

        test('should reject invalid hashtags', () => {
            expect(scanner.isValidHashtag('UPPERCASE')).toBe(false);
            expect(scanner.isValidHashtag('123')).toBe(false);
            expect(scanner.isValidHashtag('has space')).toBe(false);
        });
    });
});
