import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Daily 03:00 UTC: hard-delete issues whose soft-delete is older than the
// 30-day TTL declared in `convex/issues.ts`. Off-peak hour keeps any incident
// fallout away from US/Europe working hours.
crons.daily(
  'purge-old-soft-deleted',
  { hourUTC: 3, minuteUTC: 0 },
  internal.issues.purgeOldSoftDeleted
);

export default crons;
