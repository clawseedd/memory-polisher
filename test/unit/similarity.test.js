/**
 * Similarity Module Tests
 */

const Similarity = require('../../src/core/similarity');

describe('Similarity', () => {
    const mockConfig = {
        topic_similarity: {
            method: 'levenshtein',
            threshold: 0.8
        },
        synonyms: [
            ['trading', 'trade', 'market'],
            ['coding', 'code', 'dev']
        ]
    };
    const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    };

    describe('applySynonymRules', () => {
        test('should apply synonym rules', () => {
            const similarity = new Similarity(mockConfig, mockLogger);
            const tags = ['trading', 'trade', 'coding'];

            const proposals = similarity.applySynonymRules(tags);

            expect(proposals).toHaveLength(1);
            expect(proposals[0]).toMatchObject({
                canonical: 'trading',
                alias: 'trade',
                confidence: 1.0,
                method: 'synonym_rule'
            });
        });

        test('should handle missing canonical', () => {
            const similarity = new Similarity(mockConfig, mockLogger);
            const tags = ['trade', 'market']; // No 'trading'

            const proposals = similarity.applySynonymRules(tags);

            expect(proposals).toHaveLength(1);
            expect(proposals[0].canonical).toBe('trade'); // First found becomes canonical
        });
    });

    describe('computeMechanicalSimilarity', () => {
        test('should detect similar topics', () => {
            const similarity = new Similarity(mockConfig, mockLogger);
            const tags = ['trading', 'trade'];
            const discoveredTopics = {
                trading: { count: 10 },
                trade: { count: 3 }
            };

            const proposals = similarity.computeMechanicalSimilarity(tags, discoveredTopics);

            expect(proposals.length).toBeGreaterThan(0);
            expect(proposals[0]).toMatchObject({
                canonical: 'trading', // More frequent
                alias: 'trade',
                method: 'levenshtein'
            });
        });

        test('should use substring bonus', () => {
            const similarity = new Similarity(mockConfig, mockLogger);
            const tags = ['python', 'py'];
            const discoveredTopics = {
                python: { count: 10 },
                py: { count: 5 }
            };

            const proposals = similarity.computeMechanicalSimilarity(tags, discoveredTopics);

            // Should merge due to substring match
            expect(proposals.length).toBeGreaterThan(0);
        });

        test('should not merge dissimilar topics', () => {
            const similarity = new Similarity(mockConfig, mockLogger);
            const tags = ['python', 'javascript'];
            const discoveredTopics = {
                python: { count: 10 },
                javascript: { count: 10 }
            };

            const proposals = similarity.computeMechanicalSimilarity(tags, discoveredTopics);

            expect(proposals).toHaveLength(0);
        });
    });

    describe('deduplicateProposals', () => {
        test('should remove duplicate proposals', () => {
            const similarity = new Similarity(mockConfig, mockLogger);
            const proposals = [
                { canonical: 'trading', alias: 'trade', confidence: 0.9 },
                { canonical: 'trading', alias: 'trade', confidence: 0.85 }, // Duplicate
                { canonical: 'coding', alias: 'code', confidence: 0.95 }
            ];

            const unique = similarity.deduplicateProposals(proposals);

            expect(unique).toHaveLength(2);
        });
    });
});
