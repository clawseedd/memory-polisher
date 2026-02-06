#!/usr/bin/env node
/**
 * Memory Polisher - Main Orchestrator
 * Version: 1.0.0
 * 
 * SECURITY FIXES:
 * - Prevent prototype pollution in state merging
 * - Validate config before use
 * - Use yaml.safeLoad instead of yaml.load
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const Phase0Init = require('./phases/phase0-init');
const Phase1Discover = require('./phases/phase1-discover');
const Phase2Extract = require('./phases/phase2-extract');
const Phase3Organize = require('./phases/phase3-organize');
const Phase4Update = require('./phases/phase4-update');
const Phase5Validate = require('./phases/phase5-validate');
const Phase6Resume = require('./phases/phase6-resume');

const Logger = require('./utils/logger');
const Checkpoint = require('./utils/checkpoint');

class MemoryPolisher {
    constructor(config, options = {}) {
        // SECURITY: Validate config
        this.validateConfig(config);

        this.config = config;
        this.options = options;
        this.logger = new Logger(config.logging);
        this.checkpoint = new Checkpoint(config);
        this.state = {};
    }

    /**
     * SECURITY: Validate configuration to prevent injection
     */
    validateConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('Invalid config: must be an object');
        }

        // Validate required fields
        const required = ['execution_mode', 'topic_similarity', 'advanced', 'logging'];
        for (const field of required) {
            if (!config[field]) {
                throw new Error(`Missing required config field: ${field}`);
            }
        }

        // Validate paths don't contain traversal
        const pathFields = [
            config.advanced?.topics_directory,
            config.advanced?.archive_directory,
            config.advanced?.cache_directory
        ];

        for (const pathField of pathFields) {
            if (pathField && pathField.includes('..')) {
                throw new Error(`Invalid path in config (contains ..): ${pathField}`);
            }
        }
    }

    async run() {
        const startTime = Date.now();

        try {
            this.logger.info('✨ Memory Polisher v1.0.0 starting...');

            // Optional: clear checkpoint / disable resume
            if (this.options.clear_checkpoint || this.options.no_resume || this.options.force_from_phase !== undefined) {
                try {
                    await this.checkpoint.delete();
                } catch {
                    // ignore
                }
            }

            if (!this.options.no_resume && this.options.force_from_phase === undefined) {
                const resumePhase = new Phase6Resume(this.config, this.logger);
                const resumeResult = await resumePhase.execute();

                if (resumeResult.shouldResume) {
                    this.logger.info(`⏸️  Resuming from phase ${resumeResult.checkpoint.current_phase}`);
                    this.state = resumeResult.checkpoint;
                    return await this.resumeExecution(resumeResult.checkpoint);
                }
            }

            await this.executePhases();

            // Mark checkpoint as completed & archive it so future runs don't show "interrupted"
            try {
                await this.checkpoint.save({
                    ...this.state,
                    status: 'completed',
                    current_phase: '5',
                    completed_steps: ['0', '1', '2', '3', '4', '5']
                });
                await this.checkpoint.archive();
            } catch {
                // ignore
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            this.logger.success(`✅ Memory polisher complete in ${duration}s`);

            return { success: true, state: this.state };

        } catch (error) {
            this.logger.error('❌ Memory polisher failed:', error);

            const phase5 = new Phase5Validate(this.config, this.logger, this.state);
            await phase5.rollback();

            throw error;
        }
    }

    async executePhases() {
        const phases = [
            { id: '0', name: 'Initialization', class: Phase0Init },
            { id: '1', name: 'Discovery', class: Phase1Discover },
            { id: '2', name: 'Extraction', class: Phase2Extract },
            { id: '3', name: 'Organization', class: Phase3Organize },
            { id: '4', name: 'Update', class: Phase4Update },
            { id: '5', name: 'Validation', class: Phase5Validate }
        ];

        for (const phaseInfo of phases) {
            if (this.options.only_phases && !this.options.only_phases.includes(phaseInfo.id)) {
                this.logger.info(`⏩ Skipping Phase ${phaseInfo.id} (not in only_phases)`);
                continue;
            }

            this.logger.info(`\n📍 Phase ${phaseInfo.id}: ${phaseInfo.name}`);

            const phase = new phaseInfo.class(this.config, this.logger, this.state);
            const result = await phase.execute();

            // FIX: Prevent prototype pollution - use safe merge
            this.state = this.safeMerge(this.state, result);

            await this.checkpoint.save({
                ...this.state,
                current_phase: phaseInfo.id,
                completed_steps: [...(this.state.completed_steps || []), phaseInfo.id]
            });

            this.logger.debug(`Phase ${phaseInfo.id} checkpoint saved`);
        }
    }

    /**
     * SECURITY FIX: Safe object merge to prevent prototype pollution
     */
    safeMerge(target, source) {
        const merged = { ...target };

        for (const key of Object.keys(source)) {
            // Reject dangerous keys
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                this.logger.warn(`Rejected dangerous key in merge: ${key}`);
                continue;
            }

            merged[key] = source[key];
        }

        return merged;
    }

    async resumeExecution(checkpoint) {
        const startTime = Date.now();

        const phaseMap = {
            '0': Phase0Init,
            '1': Phase1Discover,
            '2': Phase2Extract,
            '3': Phase3Organize,
            '4': Phase4Update,
            '5': Phase5Validate
        };

        const startPhase = parseInt(checkpoint.current_phase) || 0;
        const phaseIds = Object.keys(phaseMap).map(Number).sort();

        this.logger.info(`⏭️  Skipping phases: ${phaseIds.slice(0, startPhase).join(', ')}`);

        for (const phaseId of phaseIds.slice(startPhase)) {
            const phaseClass = phaseMap[phaseId.toString()];
            const phase = new phaseClass(this.config, this.logger, this.state);

            this.logger.info(`\n📍 Phase ${phaseId} (resumed)`);
            const result = await phase.execute();

            this.state = this.safeMerge(this.state, result);

            await this.checkpoint.save({
                ...this.state,
                current_phase: phaseId.toString(),
                completed_steps: [...(this.state.completed_steps || []), phaseId.toString()]
            });
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.logger.success(`✅ Resume complete in ${duration}s`);

        return { success: true, state: this.state, resumed: true };
    }
}

/**
 * CLI Entry Point
 */
async function main() {
    const args = process.argv.slice(2);
    const options = {};

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--dry-run') options.dry_run = true;
        if (args[i] === '--archive' && args[i + 1]) options.archive = args[++i] === 'true';
        if (args[i] === '--verbose') options.verbose = true;
        if (args[i] === '--lookback-days' && args[i + 1]) options.lookback_days = parseInt(args[++i]);

        // Force execution start from a given phase (e.g. 0) and ignore resume checkpoint
        if ((args[i] === '--force-from-phase' || args[i] === '--from-phase') && args[i + 1]) {
            options.force_from_phase = String(args[++i]);
        }
        if (args[i] === '--no-resume') options.no_resume = true;
        if (args[i] === '--clear-checkpoint') options.clear_checkpoint = true;
    }

    // Workspace/memory directory resolution
    // Many phases expect "<cwd>/memory".
    // When run under OpenClaw, cwd is usually the workspace root, but harden
    // for manual runs (e.g., running from the skill folder).
    const isWorkspaceDir = async (dir) => {
        try {
            await fs.access(path.join(dir, 'memory'));
            // Heuristic: real OpenClaw workspace root also contains AGENTS.md
            await fs.access(path.join(dir, 'AGENTS.md'));
            return true;
        } catch {
            return false;
        }
    };

    const candidates = [];
    if (process.env.MEMORY_DIR) {
        candidates.push(path.resolve(process.env.MEMORY_DIR, '..'));
    }
    if (process.env.OPENCLAW_WORKSPACE) {
        candidates.push(path.resolve(process.env.OPENCLAW_WORKSPACE));
    }

    // current dir and parents
    {
        let cur = process.cwd();
        for (let depth = 0; depth < 6; depth++) {
            candidates.push(cur);
            const parent = path.dirname(cur);
            if (parent === cur) break;
            cur = parent;
        }
    }

    // common layout: <workspace>/skills/<skill>/src/index.js
    candidates.push(path.resolve(__dirname, '../../..'));

    let resolvedWorkspace = null;
    for (const c of candidates) {
        // eslint-disable-next-line no-await-in-loop
        if (await isWorkspaceDir(c)) {
            resolvedWorkspace = c;
            break;
        }
    }

    if (resolvedWorkspace && resolvedWorkspace !== process.cwd()) {
        process.chdir(resolvedWorkspace);
    }

    // Load config.yaml
    // NOTE: js-yaml v4 removed safeLoad; yaml.load is safe by default.
    const configPath = path.join(__dirname, '../config.yaml');
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(configContent);

    if (options.verbose) config.logging.verbose = true;
    if (options.archive !== undefined) config.archive.enabled = options.archive;
    if (options.lookback_days) config.advanced.lookback_days = options.lookback_days;

    const polisher = new MemoryPolisher(config, options);
    await polisher.run();
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = MemoryPolisher;
