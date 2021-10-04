import express from 'express';
import { ConnectionScanAlgorithmController } from '../controller/connectionScanAlgorithmController';
import { ProfileConnectionScanAlgorithmController } from '../controller/profileConnectionScanAlgorithmController';


const router = express.Router();
router.get('/earliestArrival', (req, res) => {
    ConnectionScanAlgorithmController.connectionScanAlgorithm(req, res);
});
router.get('/earliestArrivalProfile', (req, res) => {
    ProfileConnectionScanAlgorithmController.profileConnectionScanAlgorithm(req, res);
});

export default router