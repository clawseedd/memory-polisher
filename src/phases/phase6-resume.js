/**
 * Phase 6: Resume Support
 * 
 * Responsibilities:
 * - Detect existing checkpoint
 * - Prompt user for resume
 * - Load checkpoint state
 */

const Checkpoint = require('../utils/checkpoint');

class Phase6Resume {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.checkpoint = new Checkpoint(config);
    }

    async execute() {
        // Check if resume is enabled
        if (!this.config.recovery.enable_checkpoints) {
            return { shouldResume: false };
        }

        // Check for existing checkpoint
        const exists = await this.checkpoint.exists();

        if (!exists) {
            return { shouldResume: false };
        }

        // Load checkpoint
        const checkpointData = await this.checkpoint.load();

        // Check if already completed
        if (checkpointData.status === 'completed') {
            this.logger.info('Previous polish session already completed');

            // Offer to start fresh
            const startFresh = await this.promptStartFresh(checkpointData);

            if (startFresh) {
                await this.checkpoint.archive();
                return { shouldResume: false };
            } else {
                process.exit(0);
            }
        }

        // Calculate session age
        const age = await this.checkpoint.getAge();
        const ageMinutes = Math.floor(age / 60);

        // Show resume prompt
        this.logger.info(`\n⏸️  Interrupted polish session detected\n`);
        this.logger.info(`Session Details:`);
        this.logger.info(`  Started: ${checkpointData.started_at}`);
        this.logger.info(`  Last Update: ${ageMinutes} minutes ago`);
        this.logger.info(`  Last Phase: ${checkpointData.current_phase}`);
        this.logger.info(`  Progress: ${this.checkpoint.calculateProgress(checkpointData)}%\n`);

        this.logger.info(`Completed:`);
        for (const step of checkpointData.completed_steps || []) {
            this.logger.success(`  ✓ Phase ${step}`);
        }

        this.logger.info(`\nPending:`);
        const pendingPhases = ['0', '1', '2', '3', '4', '5'].filter(
            p => !checkpointData.completed_steps.includes(p)
        );
        for (const phase of pendingPhases) {
            this.logger.info(`  ⏳ Phase ${phase}`);
        }

        // For CLI usage, auto-resume is default
        // In interactive mode, this would prompt the user
        const shouldResume = true; // Auto-resume in non-interactive mode

        if (shouldResume) {
            this.logger.info(`\n✓ Resuming from Phase ${checkpointData.current_phase}`);
            return {
                shouldResume: true,
                checkpoint: checkpointData
            };
        } else {
            await this.checkpoint.archive();
            return { shouldResume: false };
        }
    }

    async promptStartFresh(checkpointData) {
        // In non-interactive mode, default to starting fresh
        // In interactive mode, this would prompt the user
        return true;
    }
}

module.exports = Phase6Resume;
