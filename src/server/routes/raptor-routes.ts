import express from 'express';
import { RaptorAlgorithmController } from '../controller/raptorAlgorithmController';
import { RaptorMeatAlgorithmController } from '../controller/raptorMeatAlgorithmController';


const router = express.Router();
router.get('/earliestArrivalTime', (req, res) => {
    RaptorAlgorithmController.raptorAlgorithm(req, res);
});
router.get('/minimumExpectedArrivalTime', (req, res) => {
    RaptorMeatAlgorithmController.raptorMeatAlgorithm(req, res);
});
export default router