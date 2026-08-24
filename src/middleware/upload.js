import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

import multer from 'multer';

import { BadRequestError } from '../shared/errors/AppError.js';

/**
 * Local disk storage for listing media.
 *
 * Deliberately the simplest thing that is actually real: files land in
 * `uploads/` beside the app and are served back as `/uploads/…`. That is
 * enough for development and a single-box deployment, and wrong for more
 * than one server — the files live on whichever machine took the request.
 *
 * Swapping this for S3/Cloudinary means changing this file and nothing
 * else: everything downstream only ever sees the URL that comes back.
 */
export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
const PET_MEDIA_DIR = join(UPLOAD_ROOT, 'pets');

/** Multer will not create these itself, and a missing folder fails per-request rather than at boot. */
for (const dir of [UPLOAD_ROOT, PET_MEDIA_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PET_MEDIA_DIR),
  filename: (req, file, cb) => {
    // Never the client's filename: it is attacker-controlled and can carry
    // path separators or collide with an existing file.
    const extension = extname(file.originalname || '').slice(0, 10).toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  },
});

export const uploadPetMedia = multer({
  storage,
  limits: {
    // Matches the client-side ceiling in MediaUpload.tsx. Enforced here too,
    // because a client-side limit is a courtesy, not a control.
    fileSize: 50 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new BadRequestError(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

/** The public path for a stored file — what gets persisted on the listing. */
export const petMediaUrl = (filename) => `/uploads/pets/${filename}`;
