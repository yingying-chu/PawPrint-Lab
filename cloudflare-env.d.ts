declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MESHY_API_KEY?: string;
    ARCADE_API_KEY?: string;
    ARCADE_USER_AGENT?: string;
    PHOTO_RETENTION_DAYS?: string;
  }
}
