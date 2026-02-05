/**
 * Math Utility Tests
 */

const Math = require('../../src/utils/math');

describe('Math', () => {
    let math;

    beforeEach(() => {
        math = new Math({}, { debug: jest.fn() });
    });

    describe('cosineSimilarity', () => {
        test('should compute similarity for identical vectors', () => {
            const vec1 = [1, 2, 3];
            const vec2 = [1, 2, 3];

            const similarity = math.cosineSimilarity(vec1, vec2);

            expect(similarity).toBeCloseTo(1.0, 5);
        });

        test('should compute similarity for orthogonal vectors', () => {
            const vec1 = [1, 0, 0];
            const vec2 = [0, 1, 0];

            const similarity = math.cosineSimilarity(vec1, vec2);

            expect(similarity).toBeCloseTo(0.0, 5);
        });

        test('should compute similarity for opposite vectors', () => {
            const vec1 = [1, 2, 3];
            const vec2 = [-1, -2, -3];

            const similarity = math.cosineSimilarity(vec1, vec2);

            expect(similarity).toBeCloseTo(-1.0, 5);
        });
    });

    describe('levenshteinDistance', () => {
        test('should compute distance for identical strings', () => {
            const distance = math.levenshteinDistance('trading', 'trading');
            expect(distance).toBe(0);
        });

        test('should compute distance for similar strings', () => {
            const distance = math.levenshteinDistance('trading', 'trade');
            expect(distance).toBe(3); // Need to add "ing"
        });

        test('should compute distance for different strings', () => {
            const distance = math.levenshteinDistance('python', 'javascript');
            expect(distance).toBeGreaterThan(5);
        });

        test('should handle empty strings', () => {
            expect(math.levenshteinDistance('', 'test')).toBe(4);
            expect(math.levenshteinDistance('test', '')).toBe(4);
            expect(math.levenshteinDistance('', '')).toBe(0);
        });
    });

    describe('normalizedLevenshtein', () => {
        test('should return value between 0 and 1', () => {
            const score = math.normalizedLevenshtein('trading', 'trade');
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(1);
        });

        test('should return 0 for identical strings', () => {
            const score = math.normalizedLevenshtein('test', 'test');
            expect(score).toBe(0);
        });
    });

    describe('magnitude', () => {
        test('should compute vector magnitude', () => {
            const vec = [3, 4]; // 3-4-5 triangle
            const mag = math.magnitude(vec);
            expect(mag).toBeCloseTo(5.0, 5);
        });

        test('should handle zero vector', () => {
            const vec = [0, 0, 0];
            const mag = math.magnitude(vec);
            expect(mag).toBe(0);
        });
    });

    describe('normalize', () => {
        test('should normalize vector to unit length', () => {
            const vec = [3, 4];
            const normalized = math.normalize(vec);
            const mag = math.magnitude(normalized);
            expect(mag).toBeCloseTo(1.0, 5);
        });

        test('should handle zero vector', () => {
            const vec = [0, 0];
            const normalized = math.normalize(vec);
            expect(normalized).toEqual([0, 0]);
        });
    });
});
