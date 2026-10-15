// Problems a provider can report, so callers (the sync job, the test runner) can
// decide what to do without knowing which provider is in use.

// Too many requests right now; try again after `retryAfterSeconds`.
export class RateLimitedError extends Error {
  constructor(message: string, readonly retryAfterSeconds: number) {
    super(message);
  }
}

// Out of allowance until tomorrow (free daily cap) or out of credit.
export class QuotaExhaustedError extends Error {}

// This one message can never be processed on the current plan (too long).
export class TooLargeError extends Error {}

// The model's answer didn't match the expected shape, or it declined to answer.
export class BadAnswerError extends Error {}
