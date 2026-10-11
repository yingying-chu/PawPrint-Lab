declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MESHY_API_KEY?: string;
    PHOTO_RETENTION_DAYS?: string;
  }
}
