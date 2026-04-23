/**
 * Retry mechanism dengan exponential backoff untuk API calls
 * @param fn - Async function yang akan di-retry
 * @param options - Konfigurasi retry
 * @returns Result dari function
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000, // 1 detik
  maxDelay: 10000, // 10 detik
  shouldRetry: (error) => {
    // Retry pada network errors, timeout, atau server errors (5xx)
    if (!error) return false;
    
    // Network errors
    if (error.code === 'NETWORK_ERROR' || 
        error.code === 'TIMEOUT' ||
        error.message?.includes('network') ||
        error.message?.includes('timeout')) {
      return true;
    }
    
    // Firebase specific errors
    if (error.code === 'unavailable' || 
        error.code === 'deadline-exceeded' ||
        error.code === 'resource-exhausted') {
      return true;
    }
    
    // HTTP status codes
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    // Rate limiting
    if (error.status === 429) {
      return true;
    }
    
    return false;
  },
  onRetry: () => {},
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, shouldRetry, onRetry } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Jika ini adalah attempt terakhir, throw error
      if (attempt === maxRetries) {
        break;
      }

      // Cek apakah error harus di-retry
      if (!shouldRetry(error)) {
        throw error;
      }

      // Hitung delay dengan exponential backoff + jitter
      const exponentialDelay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );
      
      // Tambahkan jitter (randomness) untuk menghindari thundering herd
      const jitter = Math.random() * 0.3 * exponentialDelay;
      const delay = exponentialDelay + jitter;

      // Log retry attempt
      console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${Math.round(delay)}ms...`, {
        error: error.message || error,
      });

      // Call onRetry callback
      onRetry(attempt + 1, error, delay);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Helper untuk retry Firebase operations
 */
export async function retryFirebase<T>(
  operation: string,
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,
    baseDelay: 1000,
    ...options,
    onRetry: (attempt, error, delay) => {
      console.warn(`[Firebase Retry] ${operation} - Attempt ${attempt}/3`, {
        error: error.message,
        nextRetryIn: `${Math.round(delay)}ms`,
      });
    },
  });
}

/**
 * Helper untuk retry payment gateway calls
 */
export async function retryPayment<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 2, // Payment biasanya lebih sensitif, retry lebih sedikit
    baseDelay: 2000, // Delay lebih lama untuk payment
    ...options,
  });
}

export default withRetry;
