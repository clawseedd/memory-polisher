/**
 * MathUtils Module
 * 
 * Responsibilities:
 * - Cosine similarity
 * - Levenshtein distance
 * - Vector operations
 * 
 * FIX: Renamed from Math to MathUtils to avoid shadowing global Math
 */

class MathUtils {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    cosineSimilarity(vec1, vec2) {
        if (vec1.length !== vec2.length) {
            throw new Error('Vectors must have same dimensions');
        }

        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;

        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            mag1 += vec1[i] * vec1[i];
            mag2 += vec2[i] * vec2[i];
        }

        mag1 = Math.sqrt(mag1);
        mag2 = Math.sqrt(mag2);

        if (mag1 === 0 || mag2 === 0) {
            return 0;
        }

        return dotProduct / (mag1 * mag2);
    }

    levenshteinDistance(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;

        const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

        for (let i = 0; i <= len1; i++) {
            matrix[i][0] = i;
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[len1][len2];
    }

    normalizedLevenshtein(str1, str2) {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLen = Math.max(str1.length, str2.length);
        return maxLen === 0 ? 0 : distance / maxLen;
    }

    dotProduct(vec1, vec2) {
        if (vec1.length !== vec2.length) {
            throw new Error('Vectors must have same dimensions');
        }

        let sum = 0;
        for (let i = 0; i < vec1.length; i++) {
            sum += vec1[i] * vec2[i];
        }
        return sum;
    }

    magnitude(vector) {
        let sum = 0;
        for (let i = 0; i < vector.length; i++) {
            sum += vector[i] * vector[i];
        }
        return Math.sqrt(sum);
    }

    normalize(vector) {
        const mag = this.magnitude(vector);
        if (mag === 0) return vector;
        return vector.map(v => v / mag);
    }

    euclideanDistance(vec1, vec2) {
        if (vec1.length !== vec2.length) {
            throw new Error('Vectors must have same dimensions');
        }

        let sum = 0;
        for (let i = 0; i < vec1.length; i++) {
            const diff = vec1[i] - vec2[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }
}

module.exports = MathUtils;
