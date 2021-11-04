import express from 'express';
import { ConnectionScanAlgorithmController } from '../controller/connectionScanAlgorithmController';
import { ConnectionScanMeatAlgorithmController } from '../controller/connectionScanMeatAlgorithmController';


const router = express.Router();
router.get('/earliestArrival', (req, res) => {
    ConnectionScanAlgorithmController.connectionScanAlgorithmRoute(req, res);
});
router.get('/earliestArrivalProfile', (req, res) => {
    ConnectionScanMeatAlgorithmController.connectionScanMeatAlgorithmRoute(req, res);
});

export default router