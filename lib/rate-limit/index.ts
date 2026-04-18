export {
  applyRateLimit,
  rateLimitHeaders,
  extractClientIp,
  getRedis,
} from './upstash';
export type { RateLimitConfig, RateLimitResult } from './upstash';

export { SMS_RATE_LIMITS } from './sms-presets';
export type { RateLimitPreset, SmsRateLimitKey } from './sms-presets';

export { checkSmsRateLimit, checkOtpVerifyRateLimit } from './sms-guard';
export type { SmsGuardInput, SmsGuardResult } from './sms-guard';
