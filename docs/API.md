# Memory Polisher API Documentation

## Core Modules

### Scanner

**Location:** `src/core/scanner.js`

#### Methods

##### `findDailyLogs(directory, startDate, endDate)`
Find daily log files within date range.

**Parameters:**
- `directory` (string): Path to memory directory
- `startDate` (Date): Start of date range
- `endDate` (Date): End of date range

**Returns:** Array of filenames

##### `extractHashtags(content, filename)`
Extract all hashtags from content.

**Returns:** Object with hashtag counts and occurrences

---

### Similarity

**Location:** `src/core/similarity.js`

#### Methods

##### `computePairwiseSimilarity(tags, discoveredTopics)`
Compute similarity for all tag pairs.

**Returns:** Array of merge proposals

##### `applySynonymRules(tags)`
Apply predefined synonym rules.

**Returns:** Array of proposals with confidence 1.0

---

### Parser

**Location:** `src/core/parser.js`

#### Methods

##### `parseSections(content, filename)`
Parse markdown into sections.

**Returns:** Array of section objects

---

## Utility Modules

### Checkpoint

**Location:** `src/utils/checkpoint.js`

#### Methods

##### `save(state)`
Save checkpoint state to disk.

##### `load()`
Load checkpoint from disk.

##### `exists()`
Check if checkpoint exists.

---

### Cache

**Location:** `src/utils/cache.js`

#### Methods

##### `init()`
Initialize SQLite database.

##### `getEmbedding(hashtag)`
Retrieve cached embedding.

##### `saveEmbedding(hashtag, vector, modelVersion)`
Store embedding in cache.

---

For complete API documentation, see inline JSDoc comments in source files.
