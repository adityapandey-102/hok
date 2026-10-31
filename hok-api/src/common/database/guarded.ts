import { AppError, InternalError } from "../errors/app-error";

/**
 * Runs one repository operation: AppErrors pass through untouched, anything
 * else (a driver or SQL failure) becomes a 500 InternalError "Failed to
 * <what>" that keeps the cause for the error middleware's log. `mapError`
 * lets a repository turn a known database error into its own AppError first
 * (e.g. a unique violation into a 409).
 */
export async function guarded<T>(what: string, run: () => Promise<T>, mapError?: (error: unknown) => AppError | undefined): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    const mapped = mapError?.(error);
    if (mapped) throw mapped;
    throw new InternalError(`Failed to ${what}`, error);
  }
}
