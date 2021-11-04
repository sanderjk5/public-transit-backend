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
import {cloneDeep} from 'lodash';
import { DecisionGraphController } from "./decisionGraphController";

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
    // earliest arrival time of csa
    private static earliestArrivalTimeCSA: number;
    // earliest safe arrival time of csa
    private static earliestSafeArrivalTimeCSA: number;
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
    private static lastDepartureTimesOfLastRound: number[];
    // stores the labels of the current round for each stop
    private static earliestArrivalTimesCurrentRound: Label[][];
    // stores for each stop the expected arrival times sorted by departure time. A label dominates every label with a higher departure time.
    private static expectedArrivalTimes: Label[][];
    // stores the marked stops of the current round
    private static markedStops: number[];
    // stores the route-stop pairs of the marked stops
    private static Q: QEntry[];

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
                typeof req.query.sourceStop !== 'string' || typeof req.query.targetStop !== 'string' || typeof req.query.sourceTime !== 'string' || typeof req.query.date !== 'string'){
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

            console.time('csa algorithms')
            // gets the minimum arrival times from the normal csa algorithm
            this.earliestArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, false, this.minDepartureTime + 3 * SECONDS_OF_A_DAY);
            if(this.earliestArrivalTimeCSA === null) {
                throw new Error("Couldn't find a connection.")
            }
            this.earliestSafeArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, true, this.minDepartureTime + 3 * SECONDS_OF_A_DAY);
            if(this.earliestSafeArrivalTimeCSA === null) {
                throw new Error("Couldn't find a connection.")
            }
            // calculates the maximum arrival time
            let difference = 1 * (this.earliestSafeArrivalTimeCSA - this.minDepartureTime);
            this.maxArrivalTime = this.earliestSafeArrivalTimeCSA + Math.min(difference, SECONDS_OF_A_DAY-1);
            this.earliestArrivalTimes = ConnectionScanAlgorithmController.getEarliestArrivalTimes(req.query.sourceStop, this.sourceDate, this.minDepartureTime, this.maxArrivalTime)
            console.timeEnd('csa algorithms')

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
            // gets the minimum arrival times from the normal csa algorithm
            this.earliestArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(sourceStop, targetStop, this.sourceDate, this.minDepartureTime, false, this.minDepartureTime + 3 * SECONDS_OF_A_DAY);
            if(this.earliestArrivalTimeCSA === null) {
                return null
            }
            this.earliestSafeArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(sourceStop, targetStop, this.sourceDate, this.minDepartureTime, true, this.minDepartureTime + 3 * SECONDS_OF_A_DAY);
            if(this.earliestSafeArrivalTimeCSA === null) {
                return null;
            }
            // calculates the maximum arrival time
            let difference = 1 * (this.earliestSafeArrivalTimeCSA - this.minDepartureTime);
            this.maxArrivalTime = this.earliestSafeArrivalTimeCSA + Math.min(difference, SECONDS_OF_A_DAY-1);
            this.earliestArrivalTimes = ConnectionScanAlgorithmController.getEarliestArrivalTimes(sourceStop, this.sourceDate, this.minDepartureTime, this.maxArrivalTime)
            // initializes the raptor meat algorithm
            this.init();
            const startTime = performance.now();
            this.performAlgorithm();
            const duration = performance.now() - startTime;
            return {expectedArrivalTime: this.expectedArrivalTimes[this.sourceStop][0].expectedArrivalTime, duration: duration};
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
            // updates expected arrival times with footpaths of marked stops
            //this.handleFootpaths(k);

            // updates the array of expected arrival times
            this.updateExpectedArrivalTimes();

            // termination condition
            if(this.markedStops.length === 0){
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
        // creates the arrays
        const numberOfStops = GoogleTransitData.STOPS.length;
        this.lastDepartureTimesOfLastRound = new Array(numberOfStops);
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
        this.lastDepartureTimesOfLastRound[this.targetStop] = this.maxArrivalTime;
        this.markedStops.push(this.targetStop);
        
        // updates the footpaths of the source stops
        // for(let i = 0; i < sourceStops.length; i++) {
        //     let sourceStop = sourceStops[i];
        //     let sourceFootpaths = GoogleTransitData.getAllFootpathsOfADepartureStop(sourceStop);
        //     for(let j = 0; j < sourceFootpaths.length; j++){
        //         let p = sourceFootpaths[j].departureStop;
        //         let pN = sourceFootpaths[j].arrivalStop;
        //         if(p !== pN && this.earliestArrivalTimePerRound[0][pN] > (this.earliestArrivalTimePerRound[0][p] + sourceFootpaths[j].duration)){
        //             this.earliestArrivalTimePerRound[0][pN] = this.earliestArrivalTimePerRound[0][p] + sourceFootpaths[j].duration;
        //             if(!this.markedStops.includes(pN)){
        //                 this.markedStops.push(pN);
        //             }
        //             if(this.earliestArrivalTimePerRound[0][pN] < this.earliestArrivalTime[pN]){
        //                 this.earliestArrivalTime[pN] = this.earliestArrivalTimePerRound[0][pN];
        //                 this.j[pN] = {
        //                     enterTripAtStop: p,
        //                     departureTime: this.earliestArrivalTimePerRound[0][p],
        //                     arrivalTime: this.earliestArrivalTime[pN],
        //                     tripId: null,
        //                     footpath: sourceFootpaths[j].id
        //                 }
        //             }
        //         }
        //     }
        // }
    }

    /**
     * Resets the label array for each stop.
     */
    private static initNextRound() {
        const numberOfStops = GoogleTransitData.STOPS.length;
        this.earliestArrivalTimesCurrentRound = new Array(numberOfStops);
        for(let i = 0; i < numberOfStops; i++){
            this.earliestArrivalTimesCurrentRound[i] = [];
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
                routeBag = this.updateRouteBag(routeBag, pi);
                // merges the routeBag in the current round bag of the stop
                this.mergeBagInRoundBag(routeBag, pi);
                // adds the labels of the last round of this stop to the route bag
                routeBag = this.mergeLastRoundLabelsInRouteBag(r, pi, routeBag);
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
        if(this.lastDepartureTimesOfLastRound[pi] === undefined){
            return routeBag;
        }
        // gets all trips between the minimum arrival time and the last departure of last round at this stop
        let newTripInfos: EarliestTripInfo[] = this.getTripsOfInterval(r, pi, this.lastDepartureTimesOfLastRound[pi]);
        // creates a new label for each trip
        for(let newTripInfo of newTripInfos){
            let newArrivalTime: number = 0;
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
                newArrivalTime = currentTripArrivalTime + expectedDelay;
            } 
            // sets the expected arrival time for normal stops
            else {
                let labelLastDepartureTime: number = -1;
                let relevantLabels: Label[] = [];
                let label: Label;
                // finds all labels at this stop which have a departure time between trip arrival time and trip arrival time + maxD_c (and the first departure after max delay)
                for(let j = 0; j < this.expectedArrivalTimes[pi].length; j++) {
                    label = this.expectedArrivalTimes[pi][j];
                    if(label.departureTime >= currentTripArrivalTime && label.departureTime <= currentTripArrivalTime + currentMaxDelay){
                        relevantLabels.push(label);
                    } else if(label.departureTime > currentTripArrivalTime + currentMaxDelay) {
                        relevantLabels.push(label);
                        break;
                    }
                }
                // calculates the expected arrival time when transfering at this stop
                for(let j = 0; j < relevantLabels.length; j++) {
                    label = relevantLabels[j];
                    newArrivalTime += (label.expectedArrivalTime * Reliability.getReliability(labelLastDepartureTime - currentTripArrivalTime, label.departureTime - currentTripArrivalTime, isLongDistanceTrip));
                    labelLastDepartureTime = label.departureTime;
                }
            }
            // sets the values of the new label and adds it to the route bag
            let newLabel: Label = {
                expectedArrivalTime: newArrivalTime,
                associatedTrip: newTripInfo,
                exitTripAtStop: pi,
                transferRound: this.k,
            }
            routeBag.push(newLabel);
        }
        return routeBag;
    }

    /**
     * Uses the stop times of the current stop to update the departure times of the current stop
     * @param routeBag 
     * @param pi 
     * @returns 
     */
    private static updateRouteBag(routeBag: Label[], pi: number){
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
        return newRouteBag;
    }

    // adds all labels of the route bag to the bag of the current stop
    private static mergeBagInRoundBag(bag: Label[], pi: number){        
        for(let label of bag){
            this.earliestArrivalTimesCurrentRound[pi].push(label);
        }
    }

    // uses the new labels of the current round to update the bag of expected arrival times of each stop
    private static updateExpectedArrivalTimes(){
        // initializes the new array of departure times
        this.lastDepartureTimesOfLastRound = new Array(GoogleTransitData.STOPS.length);
        // updates the expected arrival times for each stop
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            if(this.earliestArrivalTimesCurrentRound[i].length === 0){
                continue;
            }
            // adds all new labels to the labels of previous rounds
            let expectedArrivalTimesDeepClone = cloneDeep(this.expectedArrivalTimes[i]);
            for(let label of this.earliestArrivalTimesCurrentRound[i]){
                expectedArrivalTimesDeepClone.push(cloneDeep(label));
            }
            // sorts the expected arrival times by departure time
            expectedArrivalTimesDeepClone.sort((a, b) => {
                return this.sortLabelsByDepartureTime(a, b);
            })
            // checks for each label if it dominates all labels with a higher departure time
            let lastLabel = expectedArrivalTimesDeepClone[expectedArrivalTimesDeepClone.length-1];
            for(let j = expectedArrivalTimesDeepClone.length-2; j >= 0; j--){
                let currentLabel = expectedArrivalTimesDeepClone[j];
                // stores maximal one label for each departure time and deletes dominated labels
                if(lastLabel.departureTime === currentLabel.departureTime || lastLabel.expectedArrivalTime <= currentLabel.expectedArrivalTime){
                    expectedArrivalTimesDeepClone[j] = undefined;
                } else {
                    // adds the highest new departure time to the array and marks the stop if a label of the current round was added
                    if(currentLabel.transferRound === this.k && !this.markedStops.includes(i)){
                        this.markedStops.push(i);
                        this.lastDepartureTimesOfLastRound[i] = currentLabel.departureTime;
                    }
                    lastLabel = currentLabel;
                }
            }
            // adds all label of the new array which are not undefined to the expected arrival time array
            this.expectedArrivalTimes[i] = [];
            for(let j = 0; j < expectedArrivalTimesDeepClone.length; j++){
                if(expectedArrivalTimesDeepClone[j] !== undefined){
                    this.expectedArrivalTimes[i].push(expectedArrivalTimesDeepClone[j]);
                }
            }
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
     * Uses the footpaths to update the earliest arrival times.
     * @param k 
     */
    // private static handleFootpaths(k: number) {
    //     // uses the arrival times before they are updated by footpaths
    //     let numberOfMarkedStops = this.markedStops.length;
    //     let arrivalTimesInRoundK = [];
    //     for(let i = 0; i < numberOfMarkedStops; i++){
    //         let markedStop = this.markedStops[i];
    //         arrivalTimesInRoundK.push(this.earliestArrivalTimePerRound[k][markedStop])
    //     }

    //     // loop over all marked stops
    //     for(let i = 0; i < numberOfMarkedStops; i++){
    //         let markedStop = this.markedStops[i];
    //         let arrivalTimeOfMarkedStop = arrivalTimesInRoundK[i];
    //         let footPaths = GoogleTransitData.getAllFootpathsOfADepartureStop(markedStop);
    //         for(let j = 0; j < footPaths.length; j++){
    //             let p = footPaths[j].departureStop;
    //             let pN = footPaths[j].arrivalStop;
    //             // checks if the footpath minimizes the arrival time in round k
    //             if(p !== pN && this.earliestArrivalTimePerRound[k][pN] > (arrivalTimeOfMarkedStop + footPaths[j].duration)){
    //                 this.earliestArrivalTimePerRound[k][pN] = arrivalTimeOfMarkedStop + footPaths[j].duration;
    //                 if(!this.markedStops.includes(pN)){
    //                     this.markedStops.push(pN);
    //                 }
    //                 // checks if the new arrival time is smaller than the overall earliest arrival time
    //                 if(this.earliestArrivalTimePerRound[k][pN] < this.earliestArrivalTime[pN]){
    //                     this.earliestArrivalTime[pN] = this.earliestArrivalTimePerRound[k][pN];
    //                     // updates the journey pointer
    //                     this.j[pN] = {
    //                         enterTripAtStop: p,
    //                         departureTime: arrivalTimeOfMarkedStop,
    //                         arrivalTime: this.earliestArrivalTime[pN],
    //                         tripId: null,
    //                         footpath: footPaths[j].id
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // }

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
        let previousWeekday = Calculator.moduloSeven(currentWeekday - 1);
        // loops over all stop times to find all trips of the interval
        for(let i = Converter.getDayDifference(latestDeparture)+1; i >= Converter.getDayDifference(earliestArrival); i--) {
            for(let j = stopTimes.length-1; j >= 0; j--) {
                let stopTime = stopTimes[j];
                let arrivalTime = stopTime.arrivalTime;
                let serviceId = GoogleTransitData.TRIPS[stopTime.tripId].serviceId;
                // checks if the trip is available and if it departs in the given interval
                if(GoogleTransitData.CALENDAR[serviceId].isAvailable[currentWeekday] && (arrivalTime + earliestDepartureDayOffset) <= latestDeparture 
                    && (arrivalTime + earliestDepartureDayOffset) >= earliestArrival) {
                    // adds the new trip info
                    let earliestTripInfo: EarliestTripInfo = {
                        tripId: stopTime.tripId,
                        tripArrival: arrivalTime + earliestDepartureDayOffset,
                        dayOffset: earliestDepartureDayOffset,
                    }
                    earliestTripInfos.push(earliestTripInfo);
                }
                // checks if the trip which corresponds to the previous day could be catched at the current day in the interval
                let arrivalTimeOfPreviousDay = arrivalTime - SECONDS_OF_A_DAY;
                if(GoogleTransitData.CALENDAR[serviceId].isAvailable[previousWeekday] && arrivalTimeOfPreviousDay >= 0 
                    && (arrivalTimeOfPreviousDay + earliestDepartureDayOffset) <= latestDeparture && (arrivalTimeOfPreviousDay + earliestDepartureDayOffset) >= earliestArrival){
                    // adds the new trip info
                    let earliestTripInfo: EarliestTripInfo = {
                        tripId: stopTime.tripId,
                        tripArrival: arrivalTime + earliestDepartureDayOffset,
                        dayOffset: earliestDepartureDayOffset-SECONDS_OF_A_DAY,
                    }
                    earliestTripInfos.push(earliestTripInfo);
                }
            }
            // sets the new weekday
            currentWeekday = previousWeekday;
            previousWeekday = Calculator.moduloSeven(currentWeekday - 1);
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
            eatTime: Converter.secondsToTime(this.earliestArrivalTimeCSA),
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
        let targetStopLabels: Label[] = [];
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
            // let transfer = GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath];
            // if(transfer.departureStop !== transfer.arrivalStop){
            //     let transferEdge: TempEdge = {
            //         departureStop: GoogleTransitData.STOPS[transfer.departureStop].name,
            //         departureTime: p.departureTime,
            //         arrivalStop: GoogleTransitData.STOPS[transfer.arrivalStop].name,
            //         arrivalTime: p.departureTime + transfer.duration,
            //         type: 'Footpath',
            //     }
            //     expandedTempEdges.push(transferEdge);
            //     if(arrivalTimesPerStop.get(transferEdge.arrivalStop) === undefined) {
            //         arrivalTimesPerStop.set(transferEdge.arrivalStop, [transferEdge.arrivalTime]);
            //     } else {
            //         arrivalTimesPerStop.get(transferEdge.arrivalStop).push(transferEdge.arrivalTime);
            //     }
            // }
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
            // if(p.finalFootpath !== undefined){
            //     let finalFootpath = GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.finalFootpath];
            //     if(finalFootpath.departureStop !== finalFootpath.arrivalStop){
            //         let finalFootpathEdge: TempEdge = {
            //             departureStop: GoogleTransitData.STOPS[finalFootpath.departureStop].name,
            //             departureTime: p.exitTime,
            //             arrivalStop: GoogleTransitData.STOPS[finalFootpath.arrivalStop].name,
            //             arrivalTime: p.exitTime + finalFootpath.duration,
            //             type: 'Footpath',
            //         }
            //         expandedTempEdges.push(finalFootpathEdge);
            //         if(arrivalTimesPerStop.get(finalFootpathEdge.arrivalStop) === undefined) {
            //             arrivalTimesPerStop.set(finalFootpathEdge.arrivalStop, [finalFootpathEdge.arrivalTime]);
            //         } else {
            //             arrivalTimesPerStop.get(finalFootpathEdge.arrivalStop).push(finalFootpathEdge.arrivalTime);
            //         }
            //         continue;
            //     }
            // }
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
                let relevantPs: Label[] = [];
                for(let i = 0; i < this.expectedArrivalTimes[p.exitTripAtStop].length; i++) {
                    let nextP = this.expectedArrivalTimes[p.exitTripAtStop][i];
                    if(nextP.departureTime >= p.associatedTrip.tripArrival && nextP.departureTime <= (p.associatedTrip.tripArrival + maxDelay)){
                        relevantPs.push(nextP);
                    }
                    if(nextP.departureTime > (p.associatedTrip.tripArrival + maxDelay) && nextP.departureTime !== Number.MAX_VALUE){
                        relevantPs.push(nextP);
                        break;
                    }
                }
                let pLastDepartureTime = -1;
                let probabilityToTakeJourney: number;
                let nextP: Label;
                for (let i = 0; i < relevantPs.length; i++) {
                    nextP = relevantPs[i];
                    probabilityToTakeJourney = Reliability.getReliability(pLastDepartureTime - p.associatedTrip.tripArrival, nextP.departureTime - p.associatedTrip.tripArrival, isLongDistanceTrip);
                    let newP: Label = {
                        departureTime: nextP.departureTime,
                        expectedArrivalTime: nextP.expectedArrivalTime,
                        associatedTrip: nextP.associatedTrip,
                        enterTripAtStop: nextP.enterTripAtStop,
                        exitTripAtStop: nextP.exitTripAtStop,
                        transferRound: nextP.transferRound,
                        calcReliability:  p.calcReliability * probabilityToTakeJourney,
                    }
                    pLastDepartureTime = newP.departureTime;
                    priorityQueue.add(newP);
                }
            } else {
                targetStopLabels.push(p)
            }
        }
        // let meat = this.calculateMEAT(targetStopLabels);
        // gets the two graph representations
        const decisionGraphs = DecisionGraphController.getDecisionGraphs(expandedTempEdges, arrivalTimesPerStop, this.sourceStop, this.targetStop);
        meatResponse.expandedDecisionGraph = decisionGraphs.expandedDecisionGraph;
        meatResponse.compactDecisionGraph = decisionGraphs.compactDecisionGraph;
        return meatResponse;
    }

    private static calculateMEAT(targetStopLabels: Label[]){
        let meat: number = 0;
        let probabilitySum = 0;
        for(let targetStopLabel of targetStopLabels){
            let expectedDelay: number;
            if(GoogleTransitData.TRIPS[targetStopLabel.associatedTrip.tripId].isLongDistance){
                expectedDelay = Reliability.longDistanceExpectedValue;
            } else {
                expectedDelay = Reliability.normalDistanceExpectedValue;
            }
            probabilitySum += targetStopLabel.calcReliability;
            let arrivalTime = targetStopLabel.associatedTrip.tripArrival + expectedDelay;
            meat += (arrivalTime * targetStopLabel.calcReliability);
        }
        return meat;
    }
}