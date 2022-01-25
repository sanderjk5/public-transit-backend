import express from 'express';
import { ConnectionScanAlgorithmController } from '../controller/connectionScanAlgorithmController';
import { ConnectionScanEatAlgorithmController } from '../controller/connectionScanEatAlgorithmController';
import { ConnectionScanMeatAlgorithmController } from '../controller/connectionScanMeatAlgorithmController';


const router = express.Router();
router.get('/earliestArrivalTime', (req, res) => {
    ConnectionScanAlgorithmController.connectionScanAlgorithmRoute(req, res);
});
router.get('/expectedArrivalTime', (req, res) => {
    ConnectionScanEatAlgorithmController.connectionScanEatAlgorithmRoute(req, res);
});
router.get('/minimumExpectedArrivalTime', (req, res) => {
    ConnectionScanMeatAlgorithmController.connectionScanMeatAlgorithmRoute(req, res);
});

export default router