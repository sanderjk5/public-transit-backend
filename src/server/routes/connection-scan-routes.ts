import express from 'express';
import { ConnectionScanAlgorithmController } from '../controller/connectionScanAlgorithmController';


const router = express.Router();
router.get('/', (req, res) => {
    ConnectionScanAlgorithmController.connectionScanAlgorithm(req, res);
});

export default router