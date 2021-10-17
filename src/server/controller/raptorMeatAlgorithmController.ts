import express from "express";
import { ParsedQs } from "qs";
import { Calculator } from "../../data/calculator";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";

export class RaptorMeatAlgorithmController {
    private static sourceStops: number[];
    private static targetStops: number[];

    private static minDepartureTime: number;
    private static earliestArrivalTime: number;
    private static earliestSafeArrivalTime: number;
    private static maxArrivalTime: number;

    private static sourceWeekday: number;
    private static sourceDate: Date;

    public static raptorMeatAlgorithm(req: express.Request, res: express.Response) {
        try {
            // checks the parameters of the http request
            if(!req.query || !req.query.sourceStop || !req.query.targetStop || !req.query.sourceTime ||  !req.query.date ||
                typeof req.query.sourceStop !== 'string' || typeof req.query.targetStop !== 'string' || typeof req.query.sourceTime !== 'string' || typeof req.query.date !== 'string'){
                res.status(400).send();
                return;
            }
            // gets the source and target stops
            this.sourceStops = GoogleTransitData.getStopIdsByName(req.query.sourceStop);
            this.targetStops = GoogleTransitData.getStopIdsByName(req.query.targetStop);
            // converts the source time
            this.minDepartureTime = Converter.timeToSeconds(req.query.sourceTime);
            this.sourceDate = new Date(req.query.date);
            this.sourceWeekday = Calculator.moduloSeven((this.sourceDate.getDay() - 1));

            this.earliestArrivalTime = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, false);
            this.earliestSafeArrivalTime = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, true);
            if(this.earliestArrivalTime === null || this.earliestSafeArrivalTime === null) {
                throw new Error("Couldn't find a connection.")
            }

            // calculates the maximum arrival time of the alpha bounded version of the algorithm
            this.maxArrivalTime = this.earliestSafeArrivalTime + 1 * (this.earliestSafeArrivalTime - this.minDepartureTime);

            // initializes the raptor algorithm
            this.init();
            console.time('raptor meat algorithm')
            // calls the raptor
            this.performAlgorithm();
            console.timeEnd('raptor meat algorithm')
            // generates the http response which includes all information of the journey
            res.status(200).send();
        } catch (err) {
            console.log(err);
            res.status(500).send(err);
        }
    }

    private static performAlgorithm(){
        
    }

    private static init() {
        
    }

}