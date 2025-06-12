/**
 * Error handling utilities for fixtures
 */

import chalk from 'chalk';

/**
 * Custom error class for fixture operations
 */
export class FixtureError extends Error {
    public readonly context: string;
    public readonly originalError?: Error;

    constructor(message: string, context: string, originalError?: Error) {
        super(message);
        this.name = 'FixtureError';
        this.context = context;
        this.originalError = originalError;

        // Preserve stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FixtureError);
        }
    }

    /**
     * Get formatted error message for logging
     */
    public getFormattedMessage(): string {
        let message = chalk.red(`❌ ${this.context} Error: ${this.message}`);
        
        if (this.originalError) {
            message += `\n${chalk.gray('→ Original error: ' + this.originalError.message)}`;
            
            // Include stack trace in development
            if (process.env.NODE_ENV === 'development') {
                message += `\n${chalk.gray(this.originalError.stack || '')}`;
            }
        }
        
        return message;
    }
}

/**
 * Wraps a function with standardized error handling
 * @param fn Function to wrap
 * @param context Context for error messages
 * @returns Wrapped function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context: string
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        try {
            return await fn(...args);
        } catch (error) {
            const fixtureError = new FixtureError(
                error instanceof Error ? error.message : String(error),
                context,
                error instanceof Error ? error : undefined
            );
            
            console.error(fixtureError.getFormattedMessage());
            throw fixtureError;
        }
    };
}

/**
 * Attempts to execute a function with retries
 * @param fn Function to execute
 * @param options Retry options
 * @returns Result of the function
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxAttempts: number;
        context: string;
        onRetry?: (attempt: number, error: Error) => void;
    }
): Promise<T> {
    const { maxAttempts, context, onRetry } = options;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (attempt < maxAttempts) {
                if (onRetry) {
                    onRetry(attempt, lastError);
                } else {
                    console.log(chalk.yellow(`⚠️ ${context} - Attempt ${attempt}/${maxAttempts} failed, retrying...`));
                }
            }
        }
    }

    throw new FixtureError(
        `Failed after ${maxAttempts} attempts`,
        context,
        lastError
    );
}

/**
 * Log a successful operation
 */
export function logSuccess(context: string, message: string): void {
    console.log(chalk.green(`✅ ${context}: ${message}`));
}

/**
 * Log a warning
 */
export function logWarning(context: string, message: string): void {
    console.log(chalk.yellow(`⚠️ ${context}: ${message}`));
}

/**
 * Log an informational message
 */
export function logInfo(context: string, message: string): void {
    console.log(chalk.blue(`ℹ️ ${context}: ${message}`));
}

/**
 * Log a debug message (only in development)
 */
export function logDebug(context: string, message: string): void {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
        console.log(chalk.gray(`🔍 ${context}: ${message}`));
    }
}
