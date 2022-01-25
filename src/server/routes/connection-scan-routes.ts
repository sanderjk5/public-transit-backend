import express from 'express';
import { ConnectionScanAlgorithmController } from '../controller/connectionScanAlgorithmController';
import { ConnectionScanExpATAlgorithmController } from '../controller/connectionScanExpATAlgorithmController';
import { ConnectionScanMeatAlgorithmController } from '../controller/connectionScanMeatAlgorithmController';


const router = express.Router();
router.get('/earliestArrivalTime', (req, res) => {
    ConnectionScanAlgorithmController.connectionScanAlgorithmRoute(req, res);
});
router.get('/expectedArrivalTime', (req, res) => {
    ConnectionScanExpATAlgorithmController.connectionScanExpATAlgorithmRoute(req, res);
});
router.get('/minimumExpectedArrivalTime', (req, res) => {
    ConnectionScanMeatAlgorithmController.connectionScanMeatAlgorithmRoute(req, res);
});

export default router