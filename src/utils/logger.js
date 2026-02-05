/**
 * Logger Utility
 * 
 * Responsibilities:
 * - Structured logging with levels
 * - Color-coded output
 * - Debug mode support
 */

const chalk = require('chalk');

class Logger {
    constructor(config) {
        this.verbose = config?.verbose || false;
        this.colors = {
            info: chalk.blue,
            success: chalk.green,
            warn: chalk.yellow,
            error: chalk.red,
            debug: chalk.gray,
            phase: chalk.cyan.bold
        };
    }

    info(message, ...args) {
        console.log(this.colors.info('ℹ'), message, ...args);
    }

    success(message, ...args) {
        console.log(this.colors.success('✓'), message, ...args);
    }

    warn(message, ...args) {
        console.warn(this.colors.warn('⚠'), message, ...args);
    }

    error(message, ...args) {
        console.error(this.colors.error('✗'), message, ...args);
    }

    debug(message, ...args) {
        if (this.verbose) {
            console.log(this.colors.debug('→'), message, ...args);
        }
    }

    phase(message, ...args) {
        console.log('\n' + this.colors.phase('▸'), message, ...args);
    }

    /**
     * Log with custom color
     */
    log(level, message, ...args) {
        const color = this.colors[level] || chalk.white;
        console.log(color(message), ...args);
    }

    /**
     * Progress indicator
     */
    progress(current, total, label = '') {
        const percent = Math.floor((current / total) * 100);
        const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
        process.stdout.write(`\r${label} [${bar}] ${percent}%`);

        if (current === total) {
            console.log(); // New line when complete
        }
    }

    /**
     * Clear progress line
     */
    clearProgress() {
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
    }
}

module.exports = Logger;
