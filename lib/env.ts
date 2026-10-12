import { getBucket } from "./storage";

/** Server configuration, read per request so Vercel env changes apply on the next deploy. */
export const env = {
  get BUCKET() {
    return getBucket();
  },
  get ARCADE_API_KEY() {
    return process.env.ARCADE_API_KEY;
  },
  get ARCADE_USER_AGENT() {
    return process.env.ARCADE_USER_AGENT;
  },
  get MESHY_API_KEY() {
    return process.env.MESHY_API_KEY;
  },
  get PHOTO_RETENTION_DAYS() {
    return process.env.PHOTO_RETENTION_DAYS;
  },
};
