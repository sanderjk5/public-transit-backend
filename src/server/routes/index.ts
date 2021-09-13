import { Router } from 'express';
import connectionScanRouter from './connection-scan-routes';
import stopRouter from './stop-routes'

const routes = Router();

routes.use('/stops', stopRouter);
routes.use('/connectionScanAlgorithm', connectionScanRouter)

export default routes;