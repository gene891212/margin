export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus?: number
  ) { super(message); }
}

export function describeError(error: unknown): { code: string; message: string; httpStatus?: number } {
  if (error instanceof AppError) return {
    code: error.code,
    message: error.message,
    httpStatus: error.httpStatus
  };
  return {
    code: "unexpected_error",
    message: error instanceof Error ? error.message : "Unknown error"
  };
}
