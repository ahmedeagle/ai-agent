import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: {
    incr: async (key: string) => {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 15 * 60);
      }
      return count;
    },
    decrement: async (key: string) => {
      await redis.decr(key);
    },
    resetKey: async (key: string) => {
      await redis.del(key);
    }
  } as any
});
