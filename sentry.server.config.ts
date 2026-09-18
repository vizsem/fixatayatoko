import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isValidDsn = dsn && !dsn.includes('your-sentry-dsn') && !dsn.includes('your-project-id');

if (isValidDsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1, // 10% in production
    debug: false,
  });
}