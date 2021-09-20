import express from 'express';
import { StopController } from '../controller/stopController';

const router = express.Router();

router.get('/matchingNames', (req, res) => {
    StopController.getMatchingStops(req, res);
});

router.get('/isValidStop', (req, res) => {
    StopController.isValidStop(req, res);
})

export default router