import express from 'express';
import { RaptorAlgorithmController } from '../controller/raptorAlgorithmController';
import { RaptorMeatAlgorithmController } from '../controller/raptorMeatAlgorithmController';


const router = express.Router();
router.get('/earliestArrival', (req, res) => {
    RaptorAlgorithmController.raptorAlgorithm(req, res);
});
router.get('/meat', (req, res) => {
    RaptorMeatAlgorithmController.raptorMeatAlgorithm(req, res);
});
export default router