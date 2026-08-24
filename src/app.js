import 'dotenv/config';

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import { UPLOAD_ROOT } from './middleware/upload.js';
import { apiRouter } from './routes/index.js';

const corsOrigin = (process.env.CORS_ORIGIN || '*').split(',').map((origin) => origin.trim());
const apiPrefix = process.env.API_PREFIX || '/api/v1';

export const app = express();

// Behind a reverse proxy/load balancer in production, req.ip and rate-limit
// keys otherwise read the proxy's address for every request. Off by default
// so local/direct deployments aren't accidentally trusting a spoofable
// X-Forwarded-For.
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

app.disable('x-powered-by');
app.use(
  helmet({
    // Helmet's default `same-origin` policy makes the browser refuse to
    // render an uploaded image from this host inside a page served by
    // another — which is every one of our clients. The files are public
    // listing photos, so cross-origin reads are the point.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: corsOrigin.includes('*') ? true : corsOrigin,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(apiRateLimiter);

app.get('/', (req, res) => res.json({ name: 'petza-backend', status: 'ok' }));

/**
 * Uploaded listing media. Outside `apiPrefix` on purpose — these are files,
 * not API resources, and the URL stored on a listing should stay stable if
 * the API is ever versioned again.
 */
app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d', fallthrough: true }));

app.use(apiPrefix, apiRouter);

app.use(notFound);
app.use(errorHandler);
