import express from 'express';
import { RaptorAlgorithmController } from '../controller/raptorAlgorithmController';


const router = express.Router();
router.get('/', (req, res) => {
    RaptorAlgorithmController.raptorAlgorithm(req, res);
});

export default router