import express from 'express';
import { RaptorAlgorithmController } from '../controller/raptorAlgorithmController';
import { RaptorMeatAlgorithmController } from '../controller/raptorMeatAlgorithmController';
import { RaptorMeatTransferLimitationAlgorithmController } from '../controller/raptorMeatTransferLimitationController';
import { RaptorMeatTransferOptimisationAlgorithmController } from '../controller/raptorMeatTransferOptimisationAlgorithmController';


const router = express.Router();
router.get('/earliestArrivalTime', (req, res) => {
    RaptorAlgorithmController.raptorAlgorithm(req, res);
});
router.get('/minimumExpectedArrivalTime', (req, res) => {
    RaptorMeatAlgorithmController.raptorMeatAlgorithm(req, res);
});
router.get('/minimumExpectedArrivalTimeTransferOptimisation', (req, res) => {
    RaptorMeatTransferOptimisationAlgorithmController.raptorMeatTransferOptimisationAlgorithm(req, res);
});
router.get('/minimumExpectedArrivalTimeTransferLimitation', (req, res) => {
    RaptorMeatTransferLimitationAlgorithmController.raptorMeatTransferLimitationAlgorithm(req, res);
});
export default router