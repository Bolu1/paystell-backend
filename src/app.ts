import express from "express";
import morgan from "morgan";
import cors from "cors";
import sessionRouter from "./routes/session.routes";
import emailVerification from "./routes/emailVerification.routes";
import PaymentRoute from './routes/ParymentLink.routes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import healthRouter from "./routes/health.routes";

import { globalRateLimiter } from "./middlewares/globalRateLimiter.middleware";
import { validateIpAddress } from "./middlewares/ipValidation.middleware";
import { errorHandler } from "./middlewares/errorHandler";

import RateLimitMonitoringService from "./services/rateLimitMonitoring.service";
import { startExpiredSessionCleanupCronJobs } from "./utils/schedular";

// Initialize express app
const app = express();

// Apply middleware
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());
app.use(validateIpAddress);
app.use(RateLimitMonitoringService.createRateLimitMonitoringMiddleware());
app.use(globalRateLimiter);

// Start background tasks
startExpiredSessionCleanupCronJobs();

// Define routes
app.use("/session", sessionRouter);
app.use("/email-verification", emailVerification);
app.use("/paymentlink", PaymentRoute);
app.use('/auth', authRoutes);
app.use("/users", userRoutes);
app.use('/health', healthRouter);

// Error handling middleware
app.use(errorHandler);

// Export app
export default app;