export interface TurnstileVerificationResult {
  success: boolean;
  errorCodes?: string[];
  hostname?: string;
  isMockPass?: boolean;
}

/**
 * Validates a Cloudflare Turnstile token server-side.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string
): Promise<TurnstileVerificationResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // In development without secret, allow mock token or dev fallback
  if (!secretKey) {
    // Development pass
    return {
      success: true,
      isMockPass: true,
      hostname: 'development-mock',
    };
  }

  if (!token) {
    return {
      success: false,
      errorCodes: ['missing-input-response'],
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = (await response.json()) as {
      success: boolean;
      'error-codes'?: string[];
      hostname?: string;
    };

    return {
      success: data.success,
      errorCodes: data['error-codes'],
      hostname: data.hostname,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Turnstile network error';
    return {
      success: false,
      errorCodes: ['verification-failed', msg],
    };
  }
}
