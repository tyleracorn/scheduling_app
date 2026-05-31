export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorBody(code: string, message: string, details?: unknown) {
  return { error: { code, message, details } };
}
