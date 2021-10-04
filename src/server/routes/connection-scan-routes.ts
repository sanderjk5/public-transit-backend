import express from 'express';
import { ConnectionScanAlgorithmController } from '../controller/connectionScanAlgorithmController';
import { ProfileConnectionScanAlgorithmController } from '../controller/profileConnectionScanAlgorithmController';


const router = express.Router();
router.get('/earliestArrival', (req, res) => {
    ConnectionScanAlgorithmController.connectionScanAlgorithmRoute(req, res);
});
router.get('/earliestArrivalProfile', (req, res) => {
    ProfileConnectionScanAlgorithmController.profileConnectionScanAlgorithmRoute(req, res);
});

export default router