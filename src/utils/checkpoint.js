/**
 * Checkpoint Utility
 * 
 * Responsibilities:
 * - Save/load session state
 * - Enable resume functionality
 * - Track progress across phases
 * 
 * FIX: Resolve base path once at startup, not dynamically
 */

const fs = require('fs').promises;
const path = require('path');

class Checkpoint {
    constructor(config) {
        this.config = config;
        // FIX: Resolve base path once at initialization
        this.basePath = path.resolve(process.cwd(), 'memory');
        const checkpointFile =
            (config && config.recovery && config.recovery.checkpoint_file) ||
            'checkpoint.json';

        this.checkpointPath = path.join(this.basePath, checkpointFile);
    }

    async save(state) {
        const checkpoint = {
            version: '1.0.0',
            session_id: state.session_id || this.generateSessionId(),
            started_at: state.started_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            current_phase: state.current_phase,
            completed_steps: state.completed_steps || [],
            stats: state.stats || {},
            discovered_topics: state.discovered_topics || {},
            merge_proposals: state.merge_proposals || [],
            canonical_map: state.canonical_map || {},
            extractions: state.extractions || [],
            files_processed: state.files_processed || [],
            similarity_method: state.similarity_method || 'unknown',
            base_path: this.basePath // Store for verification
        };

        const dir = path.dirname(this.checkpointPath);
        await fs.mkdir(dir, { recursive: true });

        const tempPath = `${this.checkpointPath}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(checkpoint, null, 2), 'utf8');
        await fs.rename(tempPath, this.checkpointPath);

        return true;
    }

    async load() {
        try {
            const content = await fs.readFile(this.checkpointPath, 'utf8');
            const checkpoint = JSON.parse(content);

            if (checkpoint.version !== '1.0.0') {
                throw new Error(`Unsupported checkpoint version: ${checkpoint.version}`);
            }

            // FIX: Verify base path matches (detect if cwd changed)
            if (checkpoint.base_path && checkpoint.base_path !== this.basePath) {
                throw new Error(
                    `Checkpoint base path mismatch.\n` +
                    `Expected: ${this.basePath}\n` +
                    `Checkpoint: ${checkpoint.base_path}\n` +
                    `Ensure you run from the same directory.`
                );
            }

            return checkpoint;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw new Error(`Failed to load checkpoint: ${error.message}`);
        }
    }

    async exists() {
        try {
            await fs.access(this.checkpointPath);
            return true;
        } catch {
            return false;
        }
    }

    async delete() {
        try {
            await fs.unlink(this.checkpointPath);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return true;
            }
            throw error;
        }
    }

    async archive() {
        const checkpoint = await this.load();
        if (!checkpoint) return false;

        const timestamp = checkpoint.started_at.replace(/[-:T.]/g, '').slice(0, 14);
        const archivePath = this.checkpointPath.replace('.json', `_${timestamp}.json`);

        await fs.rename(this.checkpointPath, archivePath);
        return true;
    }

    async getAge() {
        const checkpoint = await this.load();
        if (!checkpoint) return null;

        const updated = new Date(checkpoint.updated_at);
        const now = new Date();
        return (now - updated) / 1000;
    }

    generateSessionId() {
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const random = Math.random().toString(36).substring(2, 8);
        return `${timestamp}-${random}`;
    }

    calculateProgress(checkpoint) {
        const totalPhases = 6;
        const currentPhase = parseInt(checkpoint.current_phase) || 0;
        return Math.floor((currentPhase / totalPhases) * 100);
    }
}

module.exports = Checkpoint;
