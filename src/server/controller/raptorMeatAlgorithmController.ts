import express from "express";
import { Calculator } from "../../data/calculator";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";
import FastPriorityQueue from 'fastpriorityqueue';
import { MeatResponse } from "../../models/MeatResponse";
import { TempEdge } from "../../models/TempEdge";
import { CHANGE_TIME, MAX_D_C_LONG, MAX_D_C_NORMAL, SECONDS_OF_A_DAY } from "../../constants";
import { Reliability } from "../../data/reliability";
import { RouteStopMapping } from "../../models/RouteStopMapping";
import { StopTime } from "../../models/StopTime";
import { performance } from 'perf_hooks';
import { DecisionGraphController } from "./decisionGraphController";
import { ConnectionScanMeatAlgorithmController } from "./connectionScanMeatAlgorithmController";

// entries of the q array
interface QEntry {
    r: number,
    p: number,
    stopSequence: number
}

// stores the information about the earliest trip
interface EarliestTripInfo {
    tripId: number,
    tripArrival: number,
    departureTime?: number,
    dayOffset: number,
}

// stores the expexted arrival time information of a stop
interface Label {
    expectedArrivalTime: number,
    departureTime?: number,
    associatedTrip?: EarliestTripInfo,
    enterTripAtStop?: number,
    exitTripAtStop?: number,
    transferRound: number,
    calcReliability?: number,
}

export class RaptorMeatAlgorithmController {
    // source stops
    private static sourceStop: number;
    // target stops
    private static targetStop: number;

    // the minimum departure time of the journey
    private static minDepartureTime: number;
    // earliest safe arrival time of csa
    private static earliestSafeArrivalTimeCSA: number;
    private static meatCSA: number;
    // the maximum arrival time of the journey
    private static maxArrivalTime: number;
    // the earliest possible arrival time of each stop
    private static earliestArrivalTimes: number[];

    // the weekday and date information of the minimum departure
    private static sourceWeekday: number;
    private static sourceDate: Date;
    // date of the meat
    private static meatDate: Date;

    // transfer counter of raptor algorithm
    private static k: number;

    // stores for each stop the latest departure time of the last round
    private static latestDepartureTimesOfLastRound: number[];
    // stores the labels of the current round for each stop
    private static expectedArrivalTimesOfCurrentRound: Label[][];
    // stores for each stop the expected arrival times sorted by departure time. A label dominates every label with a higher departure time.
    private static expectedArrivalTimes: Label[][];
    // stores the marked stops of the current round
    private static markedStops: number[];
    // stores the route-stop pairs of the marked stops
    private static Q: QEntry[];

    private static useTransferOptitimization: boolean;
    private static meatDifference: number;

    /**
     * Initializes and calls the raptor meat algorithm.
     * @param req 
     * @param res 
     * @returns 
     */
    public static raptorMeatAlgorithm(req: express.Request, res: express.Response) {
        try {
            // checks the parameters of the http request
            if(!req.query || !req.query.sourceStop || !req.query.targetStop || !req.query.sourceTime ||  !req.query.date ||
                typeof req.query.sourceStop !== 'string' || typeof req.query.targetStop !== 'string' || typeof req.query.sourceTime !== 'string' || 
                typeof req.query.date !== 'string' || typeof req.query.meatDifference !== 'string'){
                res.status(400).send();
                return;
            }
            // gets the source and target stops
            this.sourceStop = GoogleTransitData.getStopIdByName(req.query.sourceStop);
            this.targetStop = GoogleTransitData.getStopIdByName(req.query.targetStop);
            // converts the source time
            this.minDepartureTime = Converter.timeToSeconds(req.query.sourceTime);
            // sets the source date
            this.sourceDate = new Date(req.query.date);
            // sets the source weekday
            this.sourceWeekday = Calculator.moduloSeven((this.sourceDate.getDay() - 1));

            this.meatDifference = Number(req.query.meatDifference);
            this.useTransferOptitimization = false;
            if(this.meatDifference > 0){
                this.useTransferOptitimization = true;
            }

            // initializes the raptor meat algorithm
            this.init();
            console.time('raptor meat algorithm')
            // calls the raptor meat algorithm
            this.performAlgorithm();
            console.timeEnd('raptor meat algorithm')
            // generates the http response which includes all information of the journey incl. its decision graphs
            const meatResponse = this.extractDecisionGraphs();
            res.status(200).send(meatResponse);
        } catch (err) {
            console.log(err);
            res.status(500).send(err);
        }
    }

    /**
     * Tests the raptor meat algorithm.
     * @param sourceStop 
     * @param targetStop 
     * @param sourceTime 
     * @param sourceDate 
     * @returns 
     */
    public static testRaptorMeatAlgorithm(sourceStop: string, targetStop: string, sourceTime: string, sourceDate: Date){
        try{
            // gets the source and target stops
            this.sourceStop = GoogleTransitData.getStopIdByName(sourceStop);
            this.targetStop = GoogleTransitData.getStopIdByName(targetStop);
            // converts the source time
            this.minDepartureTime = Converter.timeToSeconds(sourceTime);
            // sets the source date
            this.sourceDate = sourceDate;
            // sets the source weekday
            this.sourceWeekday = Calculator.moduloSeven((this.sourceDate.getDay() - 1));

            this.meatDifference = 0;
            this.useTransferOptitimization = false;
            
            const completeStartTime = performance.now();

            // initializes the csa meat algorithm
            const initStartTime = performance.now();
            this.init();
            const initDuration = performance.now() - initStartTime;

            // calls the csa meat algorithm
            const algorithmStartTime = performance.now();
            this.performAlgorithm();
            const algorithmDuration = performance.now() - algorithmStartTime;

            // extracts decision graph
            const decisionGraphStartTime = performance.now();
            this.extractDecisionGraphs();
            const decisionGraphDuration = performance.now() - decisionGraphStartTime;

            const completeDuration = performance.now() - completeStartTime;

            return {
                expectedArrivalTime: this.expectedArrivalTimes[this.sourceStop][0].expectedArrivalTime, 
                completeDuration: completeDuration,
                initDuration: initDuration, 
                algorithmDuration: algorithmDuration, 
                decisionGraphDuration: decisionGraphDuration,
            };
        } catch(error){
            return null;
        }
    }

    /**
     * Performs the raptor meat algorithm.
     * @param targetStops 
     */
     private static performAlgorithm(){
        this.k = 0;
        while(true){
            // increases round counter
            this.k++;
            // intitializes the expected arrival time array for the next round
            this.initNextRound();
            // fills the array of route-stop pairs
            this.fillQ();
            // traverses each route and calculates the new expected arrival times
            this.traverseRoutes();

            // updates the array of expected arrival times
            this.updateExpectedArrivalTimes();

            // termination condition
            if(this.markedStops.length === 0 
                || (this.useTransferOptitimization && (this.expectedArrivalTimes[this.sourceStop][0].expectedArrivalTime - this.meatCSA) < this.meatDifference)
            ){
                break;
            }
        }
    }

    /**
     * Initializes the required arrays.
     * @param sourceStops 
     * @param sourceTime 
     */
    private static init(){
        this.earliestSafeArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(this.sourceStop, this.targetStop, this.sourceDate, this.minDepartureTime, true, this.minDepartureTime + 3 * SECONDS_OF_A_DAY);
        if(this.earliestSafeArrivalTimeCSA === null) {
            throw new Error("Couldn't find a connection.");
        }
        // calculates the maximum arrival time
        let difference = 1 * (this.earliestSafeArrivalTimeCSA - this.minDepartureTime);
        this.maxArrivalTime = this.earliestSafeArrivalTimeCSA + Math.min(difference, SECONDS_OF_A_DAY-1);
        this.earliestArrivalTimes = ConnectionScanAlgorithmController.getEarliestArrivalTimes(this.sourceStop, this.sourceDate, this.minDepartureTime, this.maxArrivalTime)

        if(this.useTransferOptitimization){
            this.meatCSA = ConnectionScanMeatAlgorithmController.getMeat(this.sourceStop, this.targetStop, this.minDepartureTime, this.sourceDate, this.earliestSafeArrivalTimeCSA, this.earliestArrivalTimes);
        }
        
        // creates the arrays
        const numberOfStops = GoogleTransitData.STOPS.length;
        this.latestDepartureTimesOfLastRound = new Array(numberOfStops);
        this.expectedArrivalTimes = new Array(numberOfStops);

        // sets the default label of each stop
        const defaultLabel: Label = {
            expectedArrivalTime: Number.MAX_VALUE,
            departureTime: Number.MAX_VALUE,
            transferRound: 0,
        }
        for(let i = 0; i < numberOfStops; i++) {
            this.expectedArrivalTimes[i] = [defaultLabel];
        }

        this.markedStops = [];
        // sets the maximum departure time of the target stops
        this.latestDepartureTimesOfLastRound[this.targetStop] = this.maxArrivalTime;
        this.markedStops.push(this.targetStop);
    }

    /**
     * Resets the label array for each stop.
     */
    private static initNextRound() {
        const numberOfStops = GoogleTransitData.STOPS.length;
        this.expectedArrivalTimesOfCurrentRound = new Array(numberOfStops);
        for(let i = 0; i < numberOfStops; i++){
            this.expectedArrivalTimesOfCurrentRound[i] = [];
        }
    }

    /**
     * Fills the Q-Array with route-stop pairs.
     */
    private static fillQ() {
        this.Q = [];
        let qTemp: QEntry[] = [];
        // stores the last stop of each route
        let routeSequenceMaxima = new Array(GoogleTransitData.ROUTES.length);
        // loop over all marked stops
        while(this.markedStops.length > 0){
            let markedStop = this.markedStops.pop();
            // gets all routes which serves the current stop
            let routesServingStop: RouteStopMapping[] = GoogleTransitData.ROUTES_SERVING_STOPS[markedStop];
            // adds all route-stop pairs with the related sequence number to qTemp
            for(let i = 0; i < routesServingStop.length; i++) {
                let routeId = routesServingStop[i].routeId;
                let stopSequence = routesServingStop[i].stopSequence;
                // sets the minimal sequence number for each route
                if(routeSequenceMaxima[routeId] === undefined || stopSequence > routeSequenceMaxima[routeId]){
                    routeSequenceMaxima[routeId] = stopSequence;
                }
                qTemp.push({r: routeId, p: markedStop, stopSequence: stopSequence});
            }
        }
        // uses qTemp and routeSequenceMaxima to add the last route-stop pair of each route to Q
        for(let i = 0; i < qTemp.length; i++){
            let qEntry = qTemp[i];
            if(routeSequenceMaxima[qEntry.r] === qEntry.stopSequence){
                this.Q.push(qEntry);
                routeSequenceMaxima[qEntry.r] = -1;
            }
        }
    }

    /**
     * Traverses each route and calculates the expected arrival times after k changes.
     * @param k 
     * @param targetStops 
     */
    private static traverseRoutes() {
        // loop over all elements of q
        for(let i= 0; i < this.Q.length; i++){
            let r = this.Q[i].r;
            let p = this.Q[i].p;
            let routeBag: Label[] = [];
            let reachedP = false;
            let addedLabelsAtLastStop = true;
            // loop over all stops of r beggining with p (from last to first stop)
            for(let j = GoogleTransitData.STOPS_OF_A_ROUTE[r].length-1; j >= 0; j--){     
                let pi = GoogleTransitData.STOPS_OF_A_ROUTE[r][j];
                if(pi === p){
                    reachedP = true;
                    // gets all labels of the last round which should be updated
                    routeBag = this.mergeLastRoundLabelsInRouteBag(r, pi, routeBag);
                    continue;
                }
                if(!reachedP){
                    continue;
                }
                // updates the route bag with the departure times of this stop
                routeBag = this.updateRouteBag(routeBag, pi, addedLabelsAtLastStop);
                // merges the routeBag in the current round bag of the stop
                this.mergeBagInExpectedArrivalTimesOfRound(routeBag, pi);
                // adds the labels of the last round of this stop to the route bag
                if(this.latestDepartureTimesOfLastRound[pi] !== undefined){
                    routeBag = this.mergeLastRoundLabelsInRouteBag(r, pi, routeBag);
                    addedLabelsAtLastStop = true;
                } else {
                    addedLabelsAtLastStop = false;
                }
            }
        }
    }

    /**
     * Uses the maixmum departure time of the last round to find all trips which can be reached at this stop.
     * Calculates the new expected arrival times of these trips and adds them to the route bag.
     * @param r 
     * @param pi 
     * @param routeBag 
     * @returns 
     */
    private static mergeLastRoundLabelsInRouteBag(r: number, pi: number, routeBag: Label[]){
        // gets all trips between the minimum arrival time and the last departure of last round at this stop
        let newTripInfos: EarliestTripInfo[] = this.getTripsOfInterval(r, pi, this.latestDepartureTimesOfLastRound[pi]);
        let newLabels: Label[] = []
        // creates a new label for each trip
        for(let newTripInfo of newTripInfos){
            let newExpectedArrivalTime: number = 0;
            // set the trip infos
            let isLongDistanceTrip = GoogleTransitData.TRIPS[newTripInfo.tripId].isLongDistance;
            let currentTripArrivalTime = newTripInfo.tripArrival;
            let currentMaxDelay = MAX_D_C_NORMAL;
            if(isLongDistanceTrip){
                currentMaxDelay = MAX_D_C_LONG;
            }
            // sets the expected arrival time for target stops
            if(this.targetStop === pi){
                let expectedDelay = Reliability.normalDistanceExpectedValue;
                if(isLongDistanceTrip){
                    expectedDelay = Reliability.longDistanceExpectedValue;
                }
                newExpectedArrivalTime = currentTripArrivalTime + expectedDelay;
            } 
            // sets the expected arrival time for normal stops
            else {
                let labelLastDepartureTime: number = -1;
                // let relevantLabels: Label[] = [];
                let label: Label;
                // finds all labels at this stop which have a departure time between trip arrival time and trip arrival time + maxD_c (and the first departure after max delay) and calculates the expected arrival time
                for(let j = 0; j < this.expectedArrivalTimes[pi].length; j++) {
                    label = this.expectedArrivalTimes[pi][j];
                    if(label.departureTime >= currentTripArrivalTime && label.departureTime <= currentTripArrivalTime + currentMaxDelay){
                        newExpectedArrivalTime += (label.expectedArrivalTime * Reliability.getReliability(labelLastDepartureTime - currentTripArrivalTime, label.departureTime - currentTripArrivalTime, isLongDistanceTrip));
                        labelLastDepartureTime = label.departureTime;
                    } else if(label.departureTime > currentTripArrivalTime + currentMaxDelay) {
                        newExpectedArrivalTime += (label.expectedArrivalTime * Reliability.getReliability(labelLastDepartureTime - currentTripArrivalTime, label.departureTime - currentTripArrivalTime, isLongDistanceTrip));
                        break;
                    }
                }
            }
            let departureTime = newTripInfo.departureTime + newTripInfo.dayOffset;
            // sets the values of the new label and adds it to the route bag
            let newLabel: Label = {
                expectedArrivalTime: newExpectedArrivalTime,
                departureTime: departureTime,
                associatedTrip: newTripInfo,
                exitTripAtStop: pi,
                transferRound: this.k,
            }
            newLabels.push(newLabel);
        }
        if(newLabels.length > 0){
            routeBag = this.addLabelsToRouteBag(newLabels, routeBag);
        }
        return routeBag;
    }

    private static addLabelsToRouteBag(newLabels: Label[], routeBag: Label[]){
        if(newLabels.length === 0){
            return routeBag;
        }
        newLabels.sort((a, b) => {
            return this.sortLabelsByDepartureTime(a, b);
        })
        if(routeBag.length === 0){
            return newLabels;
        }
        let newRouteBag: Label[] = [];
        let newLabelsIndex = newLabels.length-1;
        let routeBagIndex = routeBag.length-1;
        while(newLabelsIndex >= 0 || routeBagIndex >= 0){
            let lastNewLabel: Label = undefined;
            let lastRouteBagLabel: Label = undefined;
            if(newLabelsIndex >= 0){
                lastNewLabel = newLabels[newLabelsIndex];
            }
            if(routeBagIndex >= 0){
                lastRouteBagLabel = routeBag[routeBagIndex];
            }
            let nextLabel: Label;
            if(lastNewLabel && lastRouteBagLabel){
                if(lastNewLabel.departureTime < lastRouteBagLabel.departureTime){
                    nextLabel = lastRouteBagLabel;
                    routeBagIndex--;
                } else {
                    nextLabel = lastNewLabel;
                    newLabelsIndex--;
                }
            } else if(lastNewLabel){
                nextLabel = lastNewLabel;
                newLabelsIndex--;
            } else if(lastRouteBagLabel){
                nextLabel = lastRouteBagLabel;
                routeBagIndex--;
            }
            if(newRouteBag.length === 0){
                newRouteBag.unshift(nextLabel);
            } else if(nextLabel.expectedArrivalTime < newRouteBag[0].expectedArrivalTime) {
                if(nextLabel.departureTime === newRouteBag[0].departureTime){
                    newRouteBag[0] = nextLabel;
                } else {
                    newRouteBag.unshift(nextLabel);
                }
            }
        }
        return newRouteBag;
    }

    /**
     * Uses the stop times of the current stop to update the departure times of the current stop
     * @param routeBag 
     * @param pi 
     * @returns 
     */
    private static updateRouteBag(routeBag: Label[], pi: number, clearRouteBag: boolean){
        let newRouteBag: Label[] = [];
        // updates the departure time for each label of the route bag
        for(let label of routeBag){
            // gets the stop time of the trip at this stop
            let stopTime = GoogleTransitData.getStopTimeByTripAndStop(label.associatedTrip.tripId, pi);
            // sets the new departure time
            let departureTime = stopTime.departureTime + label.associatedTrip.dayOffset;
            if(departureTime > label.associatedTrip.tripArrival){
                departureTime -= SECONDS_OF_A_DAY;
            }
            // checks if the stop can be reached before the new departure time
            if(departureTime < this.earliestArrivalTimes[pi]){
                continue;
            }
            // sets the values of the new label and adds it to the route bag
            let newLabel: Label = {
                expectedArrivalTime: label.expectedArrivalTime,
                departureTime: departureTime,
                associatedTrip: label.associatedTrip,
                enterTripAtStop: pi,
                exitTripAtStop: label.exitTripAtStop,
                transferRound: label.transferRound,
            }
            newRouteBag.push(newLabel)
        }
        // if(clearRouteBag){
        //     newRouteBag = this.clearRouteBag(newRouteBag);
        // }
        return newRouteBag;
    }

    private static clearRouteBag(routeBag: Label[]){
        // sorts the expected arrival times by departure time
        routeBag.sort((a, b) => {
            return this.sortLabelsByDepartureTime(a, b);
        })
        let lastLabel = routeBag[routeBag.length-1];
        for(let j = routeBag.length-2; j >= 0; j--){
            let currentLabel = routeBag[j];
            // stores maximal one label for each departure time and deletes dominated labels
            if(lastLabel.expectedArrivalTime <= currentLabel.expectedArrivalTime){
                routeBag[j] = undefined;
            } else {
                lastLabel = currentLabel;
            }
        }
        // adds all label of the new array which are not undefined to the expected arrival time array
        let newRouteBag = [];
        for(let j = 0; j < routeBag.length; j++){
            if(routeBag[j] !== undefined){
                newRouteBag.push(routeBag[j]);
            }
        }
        return newRouteBag;
    }

    // adds all labels of the route bag to the bag of the current stop
    private static mergeBagInExpectedArrivalTimesOfRound(bag: Label[], pi: number){ 
        if(this.expectedArrivalTimesOfCurrentRound[pi].length === 0){
            for(let label of bag){
                this.expectedArrivalTimesOfCurrentRound[pi].push(label)
            }
            return;
        }
        if(bag.length === 0){
            return;
        }
        let newExpectedArrivalTimesOfCurrentRound: Label[] = [];
        let bagIndex = bag.length-1;
        let expectedArrivalTimesIndex = this.expectedArrivalTimesOfCurrentRound[pi].length-1;
        while(bagIndex >= 0 || expectedArrivalTimesIndex >= 0){
            let lastBagLabel: Label = undefined;
            let lastExpectedArrivalTimesLabel: Label = undefined;
            if(bagIndex >= 0){
                lastBagLabel = bag[bagIndex];
            }
            if(expectedArrivalTimesIndex >= 0){
                lastExpectedArrivalTimesLabel = this.expectedArrivalTimesOfCurrentRound[pi][expectedArrivalTimesIndex];
            }
            let nextLabel: Label;
            if(lastBagLabel && lastExpectedArrivalTimesLabel){
                if(lastBagLabel.departureTime < lastExpectedArrivalTimesLabel.departureTime){
                    nextLabel = lastExpectedArrivalTimesLabel;
                    expectedArrivalTimesIndex--;
                } else {
                    nextLabel = lastBagLabel;
                    bagIndex--;
                }
            } else if(lastBagLabel){
                nextLabel = lastBagLabel;
                bagIndex--;
            } else if(lastExpectedArrivalTimesLabel){
                nextLabel = lastExpectedArrivalTimesLabel;
                expectedArrivalTimesIndex--;
            }
            if(newExpectedArrivalTimesOfCurrentRound.length === 0){
                newExpectedArrivalTimesOfCurrentRound.unshift(nextLabel);
            } else if(nextLabel.expectedArrivalTime < newExpectedArrivalTimesOfCurrentRound[0].expectedArrivalTime) {
                if(nextLabel.departureTime === newExpectedArrivalTimesOfCurrentRound[0].departureTime){
                    newExpectedArrivalTimesOfCurrentRound[0] = nextLabel;
                } else {
                    newExpectedArrivalTimesOfCurrentRound.unshift(nextLabel);
                }
            }
        }
        this.expectedArrivalTimesOfCurrentRound[pi] = newExpectedArrivalTimesOfCurrentRound;
    }

    // uses the new labels of the current round to update the bag of expected arrival times of each stop
    private static updateExpectedArrivalTimes(){
        // initializes the new array of departure times
        this.latestDepartureTimesOfLastRound = new Array(GoogleTransitData.STOPS.length);
        // updates the expected arrival times for each stop
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            if(this.expectedArrivalTimesOfCurrentRound[i].length === 0){
                continue;
            }
            let newExpectedArrivalTimes: Label[] = [];
            let expectedArrivalTimesIndex = this.expectedArrivalTimes[i].length-1;
            let expectedArrivalTimesIndexCurrentRound = this.expectedArrivalTimesOfCurrentRound[i].length-1;
            while(expectedArrivalTimesIndex >= 0 || expectedArrivalTimesIndexCurrentRound >= 0){
                let lastExpectedArrivalTimesLabel: Label = undefined;
                let lastExpectedArrivalTimesCurrentRoundLabel: Label = undefined;
                if(expectedArrivalTimesIndex >= 0){
                    lastExpectedArrivalTimesLabel = this.expectedArrivalTimes[i][expectedArrivalTimesIndex];
                }
                if(expectedArrivalTimesIndexCurrentRound >= 0){
                    lastExpectedArrivalTimesCurrentRoundLabel = this.expectedArrivalTimesOfCurrentRound[i][expectedArrivalTimesIndexCurrentRound];
                }
                let nextLabel: Label;
                if(lastExpectedArrivalTimesLabel && lastExpectedArrivalTimesCurrentRoundLabel){
                    if(lastExpectedArrivalTimesLabel.departureTime < lastExpectedArrivalTimesCurrentRoundLabel.departureTime){
                        nextLabel = lastExpectedArrivalTimesCurrentRoundLabel;
                        expectedArrivalTimesIndexCurrentRound--;
                    } else {
                        nextLabel = lastExpectedArrivalTimesLabel;
                        expectedArrivalTimesIndex--;
                    }
                } else if(lastExpectedArrivalTimesLabel){
                    nextLabel = lastExpectedArrivalTimesLabel;
                    expectedArrivalTimesIndex--;
                } else if(lastExpectedArrivalTimesCurrentRoundLabel){
                    nextLabel = lastExpectedArrivalTimesCurrentRoundLabel;
                    expectedArrivalTimesIndexCurrentRound--;
                }
                if(newExpectedArrivalTimes.length === 0){
                    newExpectedArrivalTimes.unshift(nextLabel);
                    if(nextLabel.transferRound === this.k && !this.markedStops.includes(i)){
                        this.markedStops.push(i);
                        this.latestDepartureTimesOfLastRound[i] = nextLabel.departureTime;
                    }
                } else if(nextLabel.expectedArrivalTime < newExpectedArrivalTimes[0].expectedArrivalTime) {
                    if(nextLabel.departureTime === newExpectedArrivalTimes[0].departureTime){
                        newExpectedArrivalTimes[0] = nextLabel;
                    } else {
                        newExpectedArrivalTimes.unshift(nextLabel);
                    }
                    if(nextLabel.transferRound === this.k && !this.markedStops.includes(i)){
                        this.markedStops.push(i);
                        this.latestDepartureTimesOfLastRound[i] = nextLabel.departureTime;
                    }
                }
            }
            this.expectedArrivalTimes[i] = newExpectedArrivalTimes;
        }
    }

    /**
     * Sorts the labels by departure time, expected arrival time and transfer round.
     * @param a 
     * @param b 
     * @returns 
     */
    private static sortLabelsByDepartureTime(a: Label, b: Label){
        if(a.departureTime === b.departureTime){
            if(a.expectedArrivalTime === b.expectedArrivalTime){
                return b.transferRound - a.transferRound;
            }
            return b.expectedArrivalTime - a.expectedArrivalTime;
        }
        return a.departureTime - b.departureTime;
    }

    /**
     * Gets all trips of the route between maximum departure and minimum arrival at this trip.
     * @param r 
     * @param pi 
     * @param k 
     * @returns 
     */
    private static getTripsOfInterval(r: number, pi: number, latestDeparture: number): EarliestTripInfo[] {
        let earliestTripInfos: EarliestTripInfo[] = [];

        // all stop times of the route at this stop
        let stopTimes: StopTime[] = GoogleTransitData.getStopTimesByStopAndRoute(pi, r);

        if(stopTimes.length === 0 || this.earliestArrivalTimes[pi] === Number.MAX_VALUE) {
            return earliestTripInfos;
        }

        if(this.k > 1){
            latestDeparture -= CHANGE_TIME;
        }

        // sets the earliest possible arrival at this stop
        let earliestArrival = this.earliestArrivalTimes[pi];
        // sets the offset of the last departure
        let earliestDepartureDayOffset = Converter.getDayOffset(latestDeparture);
        // sets the weekdays
        let currentWeekday = Calculator.moduloSeven(this.sourceWeekday + Converter.getDayDifference(latestDeparture));
        // loops over all stop times to find all trips of the interval
        for(let i = Converter.getDayDifference(latestDeparture)+1; i >= Converter.getDayDifference(earliestArrival)-1; i--) {
            for(let j = stopTimes.length-1; j >= 0; j--) {
                let stopTime = stopTimes[j];
                let arrivalTime = stopTime.arrivalTime;
                let departureTime = stopTime.departureTime;
                let serviceId = GoogleTransitData.TRIPS[stopTime.tripId].serviceId;
                // checks if the trip is available and if it departs in the given interval
                if(GoogleTransitData.CALENDAR[serviceId].isAvailable[currentWeekday] && (arrivalTime + earliestDepartureDayOffset) <= latestDeparture 
                    && (arrivalTime + earliestDepartureDayOffset) >= earliestArrival) {
                    // adds the new trip info
                    let earliestTripInfo: EarliestTripInfo = {
                        tripId: stopTime.tripId,
                        tripArrival: arrivalTime + earliestDepartureDayOffset,
                        departureTime: departureTime,
                        dayOffset: earliestDepartureDayOffset,
                    }
                    earliestTripInfos.push(earliestTripInfo);
                }
            }
            // sets the new weekday
            currentWeekday = Calculator.moduloSeven(currentWeekday - 1);
            earliestDepartureDayOffset -= SECONDS_OF_A_DAY;
        }
        return earliestTripInfos;
    }

     /**
     * Extracts the decision graph.
     * @returns 
     */
      private static extractDecisionGraphs() {
        // the minimum expected arrival time and date
        let meatTime = this.expectedArrivalTimes[this.sourceStop][0].expectedArrivalTime;
        this.meatDate = new Date(this.sourceDate);
        this.meatDate.setDate(this.meatDate.getDate() + Converter.getDayDifference(meatTime));
        // sets the departure time and date
        let departureTime = this.expectedArrivalTimes[this.sourceStop][0].departureTime;
        let departureDate = new Date(this.sourceDate);
        departureDate.setDate(departureDate.getDate() + Converter.getDayDifference(departureTime))
        
        // sets the common values of the journey
        let meatResponse: MeatResponse = {
            sourceStop: GoogleTransitData.STOPS[this.sourceStop].name,
            targetStop: GoogleTransitData.STOPS[this.targetStop].name,
            departureTime: Converter.secondsToTime(this.expectedArrivalTimes[this.sourceStop][0].departureTime),
            departureDate: departureDate.toLocaleDateString('de-DE'),
            meatTime: Converter.secondsToTime(meatTime),
            meatDate: this.meatDate.toLocaleDateString('de-DE'),
            eatTime: Converter.secondsToTime(this.earliestArrivalTimes[this.targetStop]),
            esatTime: Converter.secondsToTime(this.earliestSafeArrivalTimeCSA),
            expandedDecisionGraph: {
                nodes: [],
                links: [],
                clusters: [],
            },
            compactDecisionGraph: {
                nodes: [],
                links: [],
                clusters: [],
            }
        }
        let expandedTempEdges: TempEdge[] = [];
        let arrivalTimesPerStop: Map<string, number[]> = new Map<string, number[]>();
        // priority queue sorted by the departure times
        let priorityQueue = new FastPriorityQueue<Label>((a, b) => {
            return a.departureTime < b.departureTime
        });
        if(this.expectedArrivalTimes[this.sourceStop][0].departureTime === Number.MAX_VALUE){
            throw new Error("Couldn't find a connection.")
        }
        // adds the source stop
        this.expectedArrivalTimes[this.sourceStop][0].calcReliability = 1;
        priorityQueue.add(this.expectedArrivalTimes[this.sourceStop][0]);
        while(!priorityQueue.isEmpty()){
            let p = priorityQueue.poll();
            let tripId = p.associatedTrip.tripId;
            // uses the information of the label to create an edge
            let edge: TempEdge = {
                departureStop: GoogleTransitData.STOPS[p.enterTripAtStop].name,
                departureTime: p.departureTime,
                arrivalStop: GoogleTransitData.STOPS[p.exitTripAtStop].name,
                arrivalTime: p.associatedTrip.tripArrival,
                type: 'Train',
            }
            expandedTempEdges.push(edge);
            if(arrivalTimesPerStop.get(edge.arrivalStop) === undefined) {
                arrivalTimesPerStop.set(edge.arrivalStop, [edge.arrivalTime]);
            } else {
                arrivalTimesPerStop.get(edge.arrivalStop).push(edge.arrivalTime);
            }
            // checks if the current label reaches the target
            if(p.exitTripAtStop !== this.targetStop){
                // sets max delay
                let maxDelay: number;
                let isLongDistanceTrip: boolean;
                if(GoogleTransitData.TRIPS[tripId].isLongDistance){
                    maxDelay = MAX_D_C_LONG;
                    isLongDistanceTrip = true;
                } else {
                    maxDelay = MAX_D_C_NORMAL;
                    isLongDistanceTrip = false;
                }
                // finds the next labels which can be added to the queue (every label between departure and departure + max Delay and the first one after the max Delay).
                // let relevantPs: Label[] = [];
                for(let i = 0; i < this.expectedArrivalTimes[p.exitTripAtStop].length; i++) {
                    let nextP = this.expectedArrivalTimes[p.exitTripAtStop][i];
                    if(nextP.departureTime >= p.associatedTrip.tripArrival && nextP.departureTime <= (p.associatedTrip.tripArrival + maxDelay)){
                        priorityQueue.add(nextP);
                    }
                    if(nextP.departureTime > (p.associatedTrip.tripArrival + maxDelay) && nextP.departureTime !== Number.MAX_VALUE){
                        priorityQueue.add(nextP);
                        break;
                    }
                }
            } 
        }
        // gets the two graph representations
        const decisionGraphs = DecisionGraphController.getDecisionGraphs(expandedTempEdges, arrivalTimesPerStop, this.sourceStop, this.targetStop);
        meatResponse.expandedDecisionGraph = decisionGraphs.expandedDecisionGraph;
        meatResponse.compactDecisionGraph = decisionGraphs.compactDecisionGraph;
        return meatResponse;
    }
}