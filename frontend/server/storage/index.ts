import { promises as fs } from "node:fs";
import path from "node:path";
import { getConfig } from "@/server/config/env.ts";

/**
 * Storage abstraction. Local filesystem in development, S3-compatible object
 * storage in production, behind the same interface. Keys are internal and safe;
 * user-provided filenames are never used as paths.
 */
export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

class LocalStorage implements StorageDriver {
  constructor(private baseDir: string) {}

  private resolve(key: string): string {
    const safe = key.replace(/\.\.(?:[/\\]|$)/g, "").replace(/^[/\\]+/, "");
    return path.join(this.baseDir, safe);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }
  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }
  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

class S3Storage implements StorageDriver {
  // Lazy-loaded so @aws-sdk is only required when actually used.
  private clientPromise: Promise<import("@aws-sdk/client-s3").S3Client>;
  constructor(
    private bucket: string,
    region: string,
    endpoint: string | undefined,
    credentials: { accessKeyId?: string; secretAccessKey?: string },
    private forcePathStyle: boolean,
  ) {
    this.clientPromise = import("@aws-sdk/client-s3").then(
      ({ S3Client }) =>
        new S3Client({
          region,
          endpoint,
          forcePathStyle: this.forcePathStyle,
          ...(credentials.accessKeyId && credentials.secretAccessKey
            ? { credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey } }
            : {}),
        }),
    );
  }
  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const client = await this.clientPromise;
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }));
  }
  async get(key: string): Promise<Buffer> {
    const client = await this.clientPromise;
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    return Buffer.from(bytes ?? new Uint8Array());
  }
  async delete(key: string): Promise<void> {
    const client = await this.clientPromise;
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  async exists(key: string): Promise<boolean> {
    const client = await this.clientPromise;
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}

let driver: StorageDriver | undefined;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  const cfg = getConfig().media;
  if (cfg.driver === "s3") {
    driver = new S3Storage(cfg.s3.bucket!, cfg.s3.region!, cfg.s3.endpoint, {
      accessKeyId: cfg.s3.accessKeyId,
      secretAccessKey: cfg.s3.secretAccessKey,
    }, cfg.s3.forcePathStyle);
  } else {
    driver = new LocalStorage(cfg.localDir);
  }
  return driver;
}
