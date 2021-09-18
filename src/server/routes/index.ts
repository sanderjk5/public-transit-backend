import { Router } from 'express';
import connectionScanRouter from './connection-scan-routes';
import raptorRouter from './raptor-routes';
import stopRouter from './stop-routes'

const routes = Router();

routes.use('/stops', stopRouter);
routes.use('/connectionScanAlgorithm', connectionScanRouter)
routes.use('/raptorAlgorithm', raptorRouter)

export default routes;