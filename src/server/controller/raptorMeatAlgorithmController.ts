import express from "express";
import { ParsedQs } from "qs";
import { Calculator } from "../../data/calculator";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";
import FastPriorityQueue from 'fastpriorityqueue';
import { RaptorAlgorithmController } from "./raptorAlgorithmController";
import { MeatResponse } from "../../models/MeatResponse";
import { DecisionGraph } from "../../models/DecisionGraph";
import { TempNode } from "../../models/TempNode";
import { TempEdge } from "../../models/TempEdge";
import { CHANGE_TIME, MAX_D_C_LONG, MAX_D_C_NORMAL, SECONDS_OF_A_DAY } from "../../constants";
import { Link } from "../../models/Link";
import {Node} from "../../models/Node";
import { Cluster } from "../../models/Cluster";
import { Reliability } from "../../data/reliability";
import { McRaptorAlgorithmController } from "./mcRaptorAlgorithmController";
import { RouteStopMapping } from "../../models/RouteStopMapping";
import { StopTime } from "../../models/StopTime";
import { JourneyPointerRaptor } from "../../models/JourneyPointerRaptor";
import { performance } from 'perf_hooks';
import {cloneDeep} from 'lodash';

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

interface Label {
    expectedArrivalTime: number,
    departureTime?: number,
    associatedTrip?: EarliestTripInfo,
    enterTripAtStop?: number,
    exitTripAtStop?: number,
    transferRound: number,
    arrivalTimeRound: number,
    calcReliability?: number,
}

export class RaptorMeatAlgorithmController {
    private static sourceStops: number[];
    private static targetStops: number[];

    private static minDepartureTime: number;
    private static earliestArrivalTimeCSA: number;
    private static earliestSafeArrivalTimeCSA: number;
    private static maxArrivalTime: number;
    private static earliestArrivalTimes: number[];

    private static sourceWeekday: number;
    private static sourceDate: Date;
    private static meatDate: Date;

    private static k: number;
    private static arrivalTimeRound: number;

    // stores for each round k and each stop the earliest arrival time
    private static earliestArrivalTimesLastRound: Label[][];
    private static earliestArrivalTimesCurrentRound: Label[][];
    private static earliestExpectedArrivalTimes: Label[][];
    // stores the marked stops of the current round
    private static markedStops: number[][];
    // stores the route-stop pairs of the marked stops
    private static Q: QEntry[];

    private static arrivalTimesOfTarget: number[];

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

            console.time('csa algorithms')
            // gets the minimum times from the normal csa algorithm
            this.earliestArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, false);
            this.earliestSafeArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, true);
            if(this.earliestSafeArrivalTimeCSA === null || this.earliestArrivalTimeCSA === null) {
                throw new Error("Couldn't find a connection.")
            }
            this.maxArrivalTime = this.earliestSafeArrivalTimeCSA + 1 * (this.earliestSafeArrivalTimeCSA - this.minDepartureTime);
            console.log(Converter.secondsToTime(this.maxArrivalTime))
            this.earliestArrivalTimes = ConnectionScanAlgorithmController.getEarliestArrivalTimes(req.query.sourceStop, this.sourceDate, this.minDepartureTime, this.maxArrivalTime)
            console.timeEnd('csa algorithms')
            // calculates the maximum arrival time of the alpha bounded version of the algorithm
            

            // initializes the raptor algorithm
            this.init();
            console.time('raptor meat algorithm')
            // calls the raptor
            this.performAlgorithm();
            console.timeEnd('raptor meat algorithm')
            // console.log(this.earliestArrivalTimePerRound[this.earliestArrivalTimePerRound.length-1][this.sourceStops[0]])
            // for(let i = 0; i < this.earliestArrivalTimePerRound.length; i++){
            //     console.log(i);
            //     console.log(this.earliestArrivalTimePerRound[i][6352]);
            // }
            // console.log(this.earliestExpectedArrivalTimes[6340])
            // console.log(this.earliestArrivalTimePerRound[this.earliestArrivalTimePerRound.length-1][6340])
            // console.log(Converter.secondsToTime(this.earliestArrivalTimePerRound[this.earliestArrivalTimePerRound.length-1][6340][0].expectedArrivalTime))
            // console.log(this.earliestArrivalTimePerRound[this.earliestArrivalTimePerRound.length-1][this.sourceStops[0]][0].expectedArrivalTime)
            // console.log(Converter.secondsToTime(this.earliestArrivalTimePerRound[this.earliestArrivalTimePerRound.length-1][6340][0].departureTime))
            //McRaptorAlgorithmController.getJourneyPointersOfRaptorAlgorithm(this.sourceStops, this.targetStops, this.sourceDate, this.minDepartureTime, this.maxArrivalTime);
            // generates the http response which includes all information of the journey
            const meatResponse = this.extractDecisionGraphs();
            res.status(200).send(meatResponse);
        } catch (err) {
            console.log(err);
            res.status(500).send(err);
        }
    }

    // public static testRaptorMeatAlgorithm(sourceStop: string, targetStop: string, sourceTime: string, sourceDate: Date){
    //     this.sourceStops = GoogleTransitData.getStopIdsByName(sourceStop);
    //     this.targetStops = GoogleTransitData.getStopIdsByName(targetStop);
    //     // converts the source time
    //     this.minDepartureTime = Converter.timeToSeconds(sourceTime);
    //     this.sourceDate = sourceDate;
    //     this.sourceWeekday = Calculator.moduloSeven((this.sourceDate.getDay() - 1));
    //     this.earliestArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, false);
    //     this.earliestSafeArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, true);
    //     if(this.earliestSafeArrivalTimeCSA === null || this.earliestArrivalTimeCSA === null) {
    //         throw new Error("Couldn't find a connection.")
    //     }
    //     this.init();
    // }

    /**
     * Performs the raptor algorithm.
     * @param targetStops 
     */
     private static performAlgorithm(){
        this.k = 0;
        while(true){
            // increases round counter
            // console.log(this.earliestArrivalTimePerRound[k][this.sourceStops[0]]);
            this.k++;
            // console.log('k: ' + this.k)
            // adds an empty array to the earliest arrival times
            this.addNextArrivalTimeRound();
            this.arrivalTimeRound = 0;
            for(let i = 0; i < this.arrivalTimesOfTarget.length; i++){
                // fills the array of route-stop pairs
                this.fillQ();
                // traverses each route and updates earliest arrival times
                this.traverseRoutes();
                this.arrivalTimeRound++;
            }
            // updates earliest arrival times with footpaths of marked stops
            //this.handleFootpaths(k);

            this.updateExpectedArrivalTimes();

            // termination condition
            let markedStopsAreEmpty = true;
            for(let i = 0; i < this.arrivalTimesOfTarget.length; i++){
                if(this.markedStops[i].length > 0){
                    markedStopsAreEmpty = false;
                    break;
                }
            }
            if(markedStopsAreEmpty){
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
        const numberOfStops = GoogleTransitData.STOPS.length;
        this.earliestArrivalTimesLastRound = new Array(numberOfStops);
        this.earliestExpectedArrivalTimes = new Array(numberOfStops);

        const defaultLabel: Label = {
            expectedArrivalTime: Number.MAX_VALUE,
            departureTime: Number.MAX_VALUE,
            transferRound: 0,
            arrivalTimeRound: 0,
        }
        for(let i = 0; i < numberOfStops; i++) {
            this.earliestArrivalTimesLastRound[i] = [];
            this.earliestExpectedArrivalTimes[i] = [defaultLabel];
        }

        this.arrivalTimesOfTarget = GoogleTransitData.getAllArrivalTimesOfAStopInATimeRange(this.targetStops[0], this.earliestArrivalTimeCSA, this.maxArrivalTime);
        // console.log(this.arrivalTimesOfTarget)
        console.log(this.arrivalTimesOfTarget.length);

        this.markedStops = new Array(this.arrivalTimesOfTarget.length);

        for(let i = 0; i < this.arrivalTimesOfTarget.length; i++){
            let label: Label = {
                expectedArrivalTime: this.arrivalTimesOfTarget[i],
                departureTime: this.arrivalTimesOfTarget[i],
                transferRound: 0,
                arrivalTimeRound: i,
            }
            this.earliestArrivalTimesLastRound[this.targetStops[0]].unshift(label);
            this.markedStops[i] = [this.targetStops[0]];
        }

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
     * Adds an empty array to the earliestArrivalTimePerRound array which can be used in the next round.
     */
    private static addNextArrivalTimeRound() {
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
        while(this.markedStops[this.arrivalTimeRound].length > 0){
            let markedStop = this.markedStops[this.arrivalTimeRound].pop();
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
     * Traverses each route and updates the earliest arrival times after k changes.
     * @param k 
     * @param targetStops 
     */
    private static traverseRoutes() {
        // loop over all elements of q
        // console.log(this.k)
        for(let i= 0; i < this.Q.length; i++){
            let r = this.Q[i].r;
            let p = this.Q[i].p;
            let routeBag: Label[] = [];
            let reachedP = false;
            // loop over all stops of r beggining with p
            for(let j = GoogleTransitData.STOPS_OF_A_ROUTE[r].length-1; j >= 0; j--){     
                let pi = GoogleTransitData.STOPS_OF_A_ROUTE[r][j];
                if(pi === p){
                    reachedP = true;
                    routeBag = this.mergeLastRoundLabelsInRouteBag(r, pi, routeBag);
                    continue;
                }
                if(!reachedP){
                    continue;
                }

                routeBag = this.updateRouteBag(routeBag, pi);

                this.mergeBagInRoundBag(routeBag, pi);
                routeBag = this.mergeLastRoundLabelsInRouteBag(r, pi, routeBag);
            }
        }
    }

    private static mergeLastRoundLabelsInRouteBag(r: number, pi: number, routeBag: Label[]){
        let lastRoundLabels = cloneDeep(this.earliestArrivalTimesLastRound[pi]);
        if(lastRoundLabels.length === 0){
            return routeBag;
        }
        for(let lastRoundLabel of lastRoundLabels){
            if(
                lastRoundLabel.transferRound !== this.k-1 
                || lastRoundLabel.expectedArrivalTime === Number.MAX_VALUE 
                || lastRoundLabel.arrivalTimeRound !== this.arrivalTimeRound
            ){
                continue;
            }
            let newTripInfo: EarliestTripInfo = this.getLatestTrip(r, pi, lastRoundLabel.departureTime);
            if(newTripInfo === null || (lastRoundLabel.associatedTrip && lastRoundLabel.associatedTrip.tripId === newTripInfo.tripId)){
                continue;
            }
            if(this.targetStops.includes(pi) && newTripInfo.tripArrival !== this.arrivalTimesOfTarget[this.arrivalTimeRound]){
                continue;
            }
            let newArrivalTime: number = 0;
            let isLongDistanceTrip = GoogleTransitData.TRIPS[newTripInfo.tripId].isLongDistance;
            let currentTripArrivalTime = newTripInfo.tripArrival;
            let currentMaxDelay = MAX_D_C_NORMAL;
            if(isLongDistanceTrip){
                currentMaxDelay = MAX_D_C_LONG;
            }
            if(this.targetStops.includes(pi)){
                let expectedDelay = Reliability.normalDistanceExpectedValue;
                if(isLongDistanceTrip){
                    expectedDelay = Reliability.longDistanceExpectedValue;
                }
                newArrivalTime = currentTripArrivalTime + expectedDelay;
            } else {
                let labelLastDepartureTime: number = -1;
                let relevantLabels: Label[] = [];
                let label: Label;
                // finds all outgoing trips which have a departure time between c_arr and c_arr + maxD_c (and the departure after max delay)
                for(let j = 0; j < this.earliestExpectedArrivalTimes[pi].length; j++) {
                    label = this.earliestExpectedArrivalTimes[pi][j];
                    if(label.departureTime >= currentTripArrivalTime && label.departureTime <= currentTripArrivalTime + currentMaxDelay){
                        relevantLabels.push(label);
                    } else if(label.departureTime > currentTripArrivalTime + currentMaxDelay) {
                        relevantLabels.push(label);
                        break;
                    }
                }
                // calculates the expected arrival time when transfering at the arrival stop of the current connection
                for(let j = 0; j < relevantLabels.length; j++) {
                    label = relevantLabels[j];
                    newArrivalTime += (label.expectedArrivalTime * Reliability.getReliability(labelLastDepartureTime - currentTripArrivalTime, label.departureTime - currentTripArrivalTime, isLongDistanceTrip));
                    labelLastDepartureTime = label.departureTime;
                }
            }
            let newLabel: Label = {
                expectedArrivalTime: newArrivalTime,
                associatedTrip: newTripInfo,
                exitTripAtStop: pi,
                transferRound: this.k,
                arrivalTimeRound: this.arrivalTimeRound,
            }
            // if(pi === 6340 && newTripInfo.tripId === 252){
            //     console.log(newLabel)
            // }
            routeBag.push(newLabel);
        }
        return routeBag;
    }

    private static updateRouteBag(routeBag: Label[], pi: number){
        let newRouteBag: Label[] = [];
        for(let label of routeBag){
            let stopTime = GoogleTransitData.getStopTimeByTripAndStop(label.associatedTrip.tripId, pi);
            let departureTime = stopTime.departureTime + label.associatedTrip.dayOffset;
            if(departureTime > label.associatedTrip.tripArrival){
                departureTime -= SECONDS_OF_A_DAY;
            }
            if(departureTime < this.earliestArrivalTimes[pi]){
                continue;
            }
            let newLabel: Label = {
                expectedArrivalTime: label.expectedArrivalTime,
                departureTime: departureTime,
                associatedTrip: label.associatedTrip,
                enterTripAtStop: pi,
                exitTripAtStop: label.exitTripAtStop,
                transferRound: label.transferRound,
                arrivalTimeRound: label.arrivalTimeRound,
            }
            newRouteBag.push(newLabel)
        }
        return newRouteBag;
    }

    private static mergeBagInRoundBag(bag: Label[], pi: number){        
        for(let label of bag){
            this.earliestArrivalTimesCurrentRound[pi].push(label);
        }
    }

    private static updateExpectedArrivalTimes(){
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            this.earliestArrivalTimesLastRound[i] = [];
            if(this.earliestArrivalTimesCurrentRound[i].length === 0){
                continue;
            }
            let expectedArrivalTimesDeepClone = cloneDeep(this.earliestExpectedArrivalTimes[i]);
            for(let label of this.earliestArrivalTimesCurrentRound[i]){
                expectedArrivalTimesDeepClone.push(cloneDeep(label));
            }
            expectedArrivalTimesDeepClone.sort((a, b) => {
                if(a.departureTime === b.departureTime){
                    if(a.expectedArrivalTime === b.expectedArrivalTime){
                        return b.transferRound - a.transferRound;
                    }
                    return b.expectedArrivalTime - a.expectedArrivalTime;
                }
                return a.departureTime - b.departureTime;
            })
            let lastLabel = expectedArrivalTimesDeepClone[expectedArrivalTimesDeepClone.length-1];
            for(let j = expectedArrivalTimesDeepClone.length-2; j >= 0; j--){
                let currentLabel = expectedArrivalTimesDeepClone[j];
                if(lastLabel.departureTime === currentLabel.departureTime || lastLabel.expectedArrivalTime <= currentLabel.expectedArrivalTime){
                    expectedArrivalTimesDeepClone[j] = undefined;
                } else {
                    if(currentLabel.transferRound === this.k && !this.markedStops[currentLabel.arrivalTimeRound].includes(i)){
                        this.markedStops[currentLabel.arrivalTimeRound].push(i);
                    }
                    if(currentLabel.transferRound === this.k){
                        this.earliestArrivalTimesLastRound[i].push(currentLabel);
                    }
                    lastLabel = currentLabel;
                }
            }
            this.earliestExpectedArrivalTimes[i] = [];
            for(let j = 0; j < expectedArrivalTimesDeepClone.length; j++){
                if(expectedArrivalTimesDeepClone[j] !== undefined){
                    this.earliestExpectedArrivalTimes[i].push(expectedArrivalTimesDeepClone[j]);
                }
            }
            // if(i === this.sourceStops[0]){
            //     console.log(this.earliestExpectedArrivalTimes[i])
            // }
        }
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
     * Gets the earliest trip of route r which can be catched at stop pi in round k.
     * @param r 
     * @param pi 
     * @param k 
     * @returns 
     */
    private static getLatestTrip(r: number, pi: number, earliestDeparture: number): EarliestTripInfo {
        let tripId: number; 
        let tripArrival: number = -1;
        let earliestTripInfo: EarliestTripInfo;
        
        let stopTimes: StopTime[] = GoogleTransitData.getStopTimesByStopAndRoute(pi, r);

        if(stopTimes.length === 0) {
            earliestTripInfo = null;
            return earliestTripInfo;
        }

        if(this.k > 1){
            earliestDeparture -= CHANGE_TIME;
        }

        let earliestDepartureDayOffset = Converter.getDayOffset(earliestDeparture);
        let previousDay = false;
        let currentWeekday = Calculator.moduloSeven(this.sourceWeekday + Converter.getDayDifference(earliestDeparture));
        let previousWeekday = Calculator.moduloSeven(currentWeekday - 1);
        // loops over all stop times until it finds the first departure after the earliestArrival
        for(let i = Converter.getDayDifference(earliestDeparture)+1; i >= 0; i--) {
            for(let j = stopTimes.length-1; j >= 0; j--) {
                let stopTime = stopTimes[j];
                let arrivalTime = stopTime.arrivalTime;
                let serviceId = GoogleTransitData.TRIPS[stopTime.tripId].serviceId;
                // checks if the trip is available and if it is a candidat for the earliest trip
                if(GoogleTransitData.CALENDAR[serviceId].isAvailable[currentWeekday] && (arrivalTime + earliestDepartureDayOffset) <= earliestDeparture 
                    && (arrivalTime + earliestDepartureDayOffset) > tripArrival) {
                    tripId = stopTime.tripId;
                    tripArrival = arrivalTime + earliestDepartureDayOffset;
                    previousDay = false;
                }
                // checks if the trip corresponds to the previous day but could be catched at the current day
                let arrivalTimeOfPreviousDay = arrivalTime - SECONDS_OF_A_DAY;
                if(GoogleTransitData.CALENDAR[serviceId].isAvailable[previousWeekday] && arrivalTimeOfPreviousDay >= 0 
                    && (arrivalTimeOfPreviousDay + earliestDepartureDayOffset) <= earliestDeparture && (arrivalTimeOfPreviousDay + earliestDepartureDayOffset) > tripArrival){
                    tripId = stopTime.tripId;
                    tripArrival = arrivalTimeOfPreviousDay + earliestDepartureDayOffset;
                    previousDay = true;
                }
            }
            if(tripId !== undefined){
                break;
            }
            currentWeekday = previousWeekday;
            previousWeekday = Calculator.moduloSeven(currentWeekday - 1);
            earliestDepartureDayOffset -= SECONDS_OF_A_DAY;
        }
        
        
        if(tripId !== undefined){
            // checks if it found a trip at the same day
            let dayOffset: number;
            if(previousDay) {
                dayOffset = earliestDepartureDayOffset-SECONDS_OF_A_DAY;
            } else {
                dayOffset = earliestDepartureDayOffset;
            }
            // updates the earliest trip information
            earliestTripInfo = {
                tripId: tripId,
                tripArrival: tripArrival,
                dayOffset: dayOffset,
            }
        } else {
            // return null if there are no stop times at this stop
            earliestTripInfo = null
        }
        
        return earliestTripInfo;
    }

     /**
     * Extracts the decision graph.
     * @returns 
     */
      private static extractDecisionGraphs() {
        // the minimum expected arrival time
        let meatTime = this.earliestExpectedArrivalTimes[this.sourceStops[0]][0].expectedArrivalTime;
        this.meatDate = new Date(this.sourceDate);
        this.meatDate.setDate(this.meatDate.getDate() + Converter.getDayDifference(meatTime));
        let departureTime = this.earliestExpectedArrivalTimes[this.sourceStops[0]][0].departureTime;
        let departureDate = new Date(this.sourceDate);
        departureDate.setDate(departureDate.getDate() + Converter.getDayDifference(departureTime))
        
        // sets the common values of the journey
        let meatResponse: MeatResponse = {
            sourceStop: GoogleTransitData.STOPS[this.sourceStops[0]].name,
            targetStop: GoogleTransitData.STOPS[this.targetStops[0]].name,
            departureTime: Converter.secondsToTime(this.earliestExpectedArrivalTimes[this.sourceStops[0]][0].departureTime),
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
        let expandedDecisionGraph: DecisionGraph = {
            nodes: [],
            links: [],
            clusters: [],
        };     
        let compactDecisionGraph: DecisionGraph = {
            nodes: [],
            links: [],
            clusters: [],
        }
        let targetStopLabels: Label[] = [];
        let expandedTempEdges: TempEdge[] = [];
        let arrivalTimesPerStop: Map<string, number[]> = new Map<string, number[]>();
        // priority queue sorted by the departure times
        let priorityQueue = new FastPriorityQueue<Label>((a, b) => {
            return a.departureTime < b.departureTime
        });
        if(this.earliestExpectedArrivalTimes[this.sourceStops[0]][0].departureTime === Number.MAX_VALUE){
            throw new Error("Couldn't find a connection.")
        }
        // adds the source stop
        this.earliestExpectedArrivalTimes[this.sourceStops[0]][0].calcReliability = 1;
        priorityQueue.add(this.earliestExpectedArrivalTimes[this.sourceStops[0]][0]);
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
            // uses the information of the profile function to create an edge
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
            // checks if the current profile reaches the target
            if(p.exitTripAtStop !== this.targetStops[0]){
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
                // finds the next profile functions which can be added to the queue (every profile between departure and departure + max Delay and the first one after the max Delay).
                let relevantPs: Label[] = [];
                for(let i = 0; i < this.earliestExpectedArrivalTimes[p.exitTripAtStop].length; i++) {
                    let nextP = this.earliestExpectedArrivalTimes[p.exitTripAtStop][i];
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
                        arrivalTimeRound: nextP.arrivalTimeRound,
                        calcReliability:  p.calcReliability * probabilityToTakeJourney,
                    }
                    pLastDepartureTime = newP.departureTime;
                    priorityQueue.add(newP);
                }
            } else {
                targetStopLabels.push(p)
            }
        }
        let meat = this.calculateMEAT(targetStopLabels);
        console.log(meat);
        console.log(Converter.secondsToTime(meat));
        let idCounter = 0;
        let tempNodes: TempNode[] = [];
        let tempNodeArr: TempNode;
        let tempNodeDep: TempNode;
        let edge: Link;
        expandedTempEdges = this.getDepartureTimesOfFootpaths(arrivalTimesPerStop, expandedTempEdges);
        // sorts the edges and eliminates duplicates
        expandedTempEdges.sort((a: TempEdge, b: TempEdge) => {
            return this.sortByDepartureTime(a, b);
        })
        expandedTempEdges = this.removeDuplicateEdges(expandedTempEdges);
        // uses the temp edges to create temp nodes and edges
        for(let tempEdge of expandedTempEdges){
            tempNodeDep = {
                id: 'id_' + idCounter.toString(),
                stop: tempEdge.departureStop,
                time: tempEdge.departureTime,
                type: 'departure',
            }
            tempNodes.push(tempNodeDep);
            idCounter++;
            tempNodeArr = {
                id: 'id_' + idCounter.toString(),
                stop: tempEdge.arrivalStop,
                time: tempEdge.arrivalTime,
                type: 'arrival',
            }
            tempNodes.push(tempNodeArr);
            idCounter++;
            edge = {
                id: 'id_' + idCounter.toString(),
                source: tempNodeDep.id,
                target: tempNodeArr.id,
                label: tempEdge.type,
            }
            expandedDecisionGraph.links.push(edge);
            idCounter++;
        }
        // sorts nodes and eliminates duplicates
        tempNodes.sort((a: TempNode, b: TempNode) => {
            return this.sortByTime(a, b);
        })
        tempNodes = this.removeDuplicateNodes(tempNodes, expandedDecisionGraph.links);
        let node: Node;
        let cluster: Cluster;
        // uses the temp nodes to create nodes and clusters
        for(let tempNode of tempNodes){
            node = {
                id: tempNode.id,
                label: Converter.secondsToTime(tempNode.time)
            }
            expandedDecisionGraph.nodes.push(node);
            let createCluster = true;
            for(let cluster of expandedDecisionGraph.clusters){
                if(cluster.label === tempNode.stop){
                    createCluster = false;
                    cluster.childNodeIds.push(node.id);
                    break;
                }
            }
            if(createCluster){
                cluster = {
                    id: 'id_' + idCounter.toString(),
                    label: tempNode.stop,
                    childNodeIds: [node.id],
                }
                expandedDecisionGraph.clusters.push(cluster);
                idCounter++;
            }
        }
        meatResponse.expandedDecisionGraph = expandedDecisionGraph;
        let compactTempEdges: TempEdge[] = this.getCompactTempEdges(expandedTempEdges);
        let arrivalTimeStringOfTarget = this.getArrivalTimeArrayOfTargetStop(expandedTempEdges);
        let arrivalStops = new Map<string, string>();
        let departureNode: Node;
        for(let compactTempEdge of compactTempEdges){
            if(compactTempEdge.departureStop === GoogleTransitData.STOPS[this.sourceStops[0]].name){
                cluster = {
                    id: 'id_' + idCounter.toString(),
                    label: compactTempEdge.departureStop,
                    childNodeIds: [],
                }
                compactDecisionGraph.clusters.push(cluster);
                idCounter++;
            }
            departureNode = {
                id: 'id_' + idCounter.toString(),
                label: Converter.secondsToTime(compactTempEdge.departureTime), 
            }
            if(compactTempEdge.lastDepartureTime !== undefined){
                departureNode.label = departureNode.label + ' - ' + Converter.secondsToTime(compactTempEdge.lastDepartureTime);
            }
            compactDecisionGraph.nodes.push(departureNode);
            idCounter++;
            for(let cluster of compactDecisionGraph.clusters){
                if(cluster.label === compactTempEdge.departureStop){
                    cluster.childNodeIds.push(departureNode.id);
                    break;
                }
            }
            if(arrivalStops.get(compactTempEdge.arrivalStop) === undefined){
                node = {
                    id: 'id_' + idCounter.toString(),
                    label: ' ',
                }
                if(compactTempEdge.arrivalStop === GoogleTransitData.STOPS[this.targetStops[0]].name){
                    node.label = arrivalTimeStringOfTarget;
                }
                compactDecisionGraph.nodes.push(node);
                arrivalStops.set(compactTempEdge.arrivalStop, node.id);
                idCounter++;
                cluster = {
                    id: 'id_' + idCounter.toString(),
                    label: compactTempEdge.arrivalStop,
                    childNodeIds: [node.id],
                }
                compactDecisionGraph.clusters.push(cluster);
                idCounter++;
            }
            edge = {
                id: 'id_' + idCounter.toString(),
                source: departureNode.id,
                target: arrivalStops.get(compactTempEdge.arrivalStop),
                label: compactTempEdge.type,
            }
            compactDecisionGraph.links.push(edge);
            idCounter++;
        }
        meatResponse.compactDecisionGraph = compactDecisionGraph;
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
        console.log(probabilitySum)
        return meat;
    }

    /**
     * Sorts temp edges by departure time, arrival time, source stop, target stop and type.
     * @param a 
     * @param b 
     * @returns 
     */
    private static sortByDepartureTime(a: TempEdge, b: TempEdge){
        if(a.departureTime < b.departureTime){
            return -1;
        }
        if(a.departureTime === b.departureTime){
            if(a.arrivalTime < b.arrivalTime){
                return -1;
            }
            if(a.arrivalTime === b.arrivalTime){
                if(a.departureStop < b.departureStop){
                    return -1;
                }
                if(a.departureStop === b.departureStop){
                    if(a.arrivalStop < b.arrivalStop){
                        return -1;
                    }
                    if(a.arrivalStop === b.arrivalStop){
                        if(a.type < b.type){
                            return -1;
                        }
                        if(a.type === b.type){
                            return 0;
                        }
                        if(a.type > b.type){
                            return 1;
                        }
                    }
                    if(a.arrivalStop > b.arrivalStop){
                        return 1;
                    }
                }
                if(a.departureStop > b.departureStop){
                    return 1;
                }
            }
            if(a.arrivalTime > b.arrivalTime){
                return 1;
            }
        }
        if(a.departureTime > b.departureTime){
            return 1
        }
    }

    /**
     * Sorts temp edges by source stop, target stop, type and departure time.
     * @param a 
     * @param b 
     * @returns 
     */
     private static sortByDepartureStop(a: TempEdge, b: TempEdge){
        if(a.departureStop < b.departureStop){
            return -1;
        }
        if(a.departureStop === b.departureStop){
            if(a.arrivalStop < b.arrivalStop){
                return -1;
            }
            if(a.arrivalStop === b.arrivalStop){
                if(a.type < b.type){
                    return -1;
                }
                if(a.type === b.type){
                    if(a.departureTime < b.departureTime){
                        return -1;
                    }
                    if(a.departureTime === b.departureTime){
                        return 0;
                    }
                    if(a.departureTime > b.departureTime){
                        return 1;
                    }
                }
                if(a.type > b.type){
                    return 1;
                }
            }
            if(a.arrivalStop > b.arrivalStop){
                return 1;
            }
        }
        if(a.departureStop > b.departureStop){
            return 1
        }
    }

    private static sortByDepartureStopAndDepartureTime(a: TempEdge, b: TempEdge){
        if(a.departureStop < b.departureStop){
            return -1;
        }
        if(a.departureStop === b.departureStop){
            if(a.departureTime < b.departureTime){
                return -1;
            }
            if(a.departureTime === b.departureTime){
                return 0;
            }
            if(a.departureTime > b.departureTime){
                return 1;
            }
        }
        if(a.departureStop > b.departureStop){
            return 1
        }
    }

    /**
     * Sorts tempNodes by time, stop and type.
     * @param a 
     * @param b 
     * @returns 
     */
    private static sortByTime(a: TempNode, b: TempNode){
        if(a.time < b.time){
            return -1;
        }
        if(a.time === b.time){
            if(a.stop < b.stop){
                return -1;
            }
            if(a.stop === b.stop){
                if(a.type < b.type){
                    return -1;
                }
                if(a.type === b.type){
                    return 0;
                }
                if(a.type > b.type){
                    return 1;
                }
            }
            if(a.stop > b.stop){
                return 1;
            }
        }
        if(a.time > b.time){
            return 1;
        }
    }

    private static getDepartureTimesOfFootpaths(arrivalTimesPerStop: Map<string, number[]>, expandedTempEdges: TempEdge[]){
        expandedTempEdges.sort((a, b) => {
            return this.sortByDepartureStopAndDepartureTime(a, b);
        });
        let lastDepartureStop: string = expandedTempEdges[0].departureStop;
        let lastArrivalTimes = arrivalTimesPerStop.get(lastDepartureStop);
        if(lastArrivalTimes !== undefined){
            lastArrivalTimes.push(Number.MAX_VALUE);
            lastArrivalTimes.sort((a, b) => a-b);
        }
        let lastArrivalTimeIndex = 0;
        for(let tempEdge of expandedTempEdges){
            if(tempEdge.departureStop !== lastDepartureStop){
                lastDepartureStop = tempEdge.departureStop;
                lastArrivalTimes = arrivalTimesPerStop.get(lastDepartureStop);
                if(lastArrivalTimes === undefined){
                    continue;
                }
                lastArrivalTimes.push(Number.MAX_VALUE);
                lastArrivalTimes.sort((a, b) => a-b);
                lastArrivalTimeIndex = 1;
            }
            if(tempEdge.type !== 'Footpath'){
                continue;
            }
            while(lastArrivalTimes[lastArrivalTimeIndex] <= tempEdge.departureTime){
                lastArrivalTimeIndex++;
            }
            let duration = tempEdge.arrivalTime - tempEdge.departureTime;
            tempEdge.departureTime = lastArrivalTimes[lastArrivalTimeIndex-1];
            tempEdge.arrivalTime = tempEdge.departureTime + duration;
        }
        return expandedTempEdges;
    }

    /**
     * Removes duplicate edges.
     * @param edges 
     * @returns 
     */
    private static removeDuplicateEdges(edges: TempEdge[]){
        if(edges.length === 0){
            return;
        }
        let lastEdge = edges[0];
        for(let i = 1; i < edges.length; i++){
            let currentEdge = edges[i];
            if(currentEdge.departureStop === lastEdge.departureStop && currentEdge.arrivalStop === lastEdge.arrivalStop && currentEdge.departureTime === lastEdge.departureTime &&
                currentEdge.arrivalTime === lastEdge.arrivalTime && currentEdge.type === lastEdge.type){
                edges[i] = undefined;
            } else {
                lastEdge = edges[i];
            }
        }
        return edges.filter(edge => edge !== undefined);
    }

    private static getCompactTempEdges(expandedTempEdges: TempEdge[]){
        let compactTempEdges = [];
        if(expandedTempEdges.length === 0){
            return compactTempEdges;
        }
        let expandedTempEdgesCopy = expandedTempEdges;
        expandedTempEdgesCopy.sort((a, b) => {
            return this.sortByDepartureStop(a, b);
        });
        let firstDepartureTime = expandedTempEdges[0].departureTime;
        let lastDepartureTime = undefined;
        let currentDepartureStop = expandedTempEdges[0].departureStop;
        let currentArrivalStop = expandedTempEdges[0].arrivalStop;
        let currentType = expandedTempEdges[0].type;
        for(let i = 1; i <= expandedTempEdgesCopy.length; i++){
            let currentTempEdge = expandedTempEdgesCopy[i];
            if(currentTempEdge && currentTempEdge.departureStop === currentDepartureStop && currentTempEdge.arrivalStop === currentArrivalStop && currentTempEdge.type === currentType) {
                lastDepartureTime = currentTempEdge.departureTime;
            } else {
                let newTempEdge: TempEdge = {
                    departureStop: currentDepartureStop,
                    arrivalStop: currentArrivalStop,
                    type: currentType,
                    departureTime: firstDepartureTime,
                    lastDepartureTime: lastDepartureTime,
                }
                compactTempEdges.push(newTempEdge);
                if(currentTempEdge){
                    firstDepartureTime = currentTempEdge.departureTime;
                    lastDepartureTime = undefined;
                    currentDepartureStop = currentTempEdge.departureStop;
                    currentArrivalStop = currentTempEdge.arrivalStop;
                    currentType = currentTempEdge.type;
                }
            }
        }
        compactTempEdges.sort((a, b) => {
            return this.sortByDepartureTime(a, b);
        })
        return compactTempEdges;
    }

    private static getArrivalTimeArrayOfTargetStop(expandedTempEdges: TempEdge[]){
        if(expandedTempEdges.length === 0){
            return '';
        }
        let earliestArrivalTime = Number.MAX_VALUE;
        let latestArrivalTime = 0;
        for(let tempEdge of expandedTempEdges){
            if(tempEdge.arrivalStop === GoogleTransitData.STOPS[this.targetStops[0]].name){
                if(tempEdge.arrivalTime < earliestArrivalTime){
                    earliestArrivalTime = tempEdge.arrivalTime;
                }
                if(tempEdge.arrivalTime > latestArrivalTime){
                    latestArrivalTime = tempEdge.arrivalTime;
                }
            }
        }
        let arrivalTimeString = Converter.secondsToTime(earliestArrivalTime);
        if(earliestArrivalTime < latestArrivalTime){
            arrivalTimeString += ' - ' + Converter.secondsToTime(latestArrivalTime);
        }
        return arrivalTimeString;
    }

    /**
     * Removes duplicate nodes and maps edge ids.
     * @param nodes 
     * @param edges 
     * @returns 
     */
    private static removeDuplicateNodes(nodes: TempNode[], edges: Link[]){
        if(nodes.length === 0){
            return;
        }
        let idMap = new Map<string, string>();
        let lastNode = nodes[0];
        for(let i = 1; i < nodes.length; i++){
            let currentNode = nodes[i];
            if(currentNode.stop === lastNode.stop && currentNode.time === lastNode.time && currentNode.type === lastNode.type){
                idMap.set(currentNode.id, lastNode.id);
                nodes[i] = undefined;
            } else {
                lastNode = nodes[i];
            }
        }
        for(let edge of edges){
            if(idMap.get(edge.source) !== undefined){
                edge.source = idMap.get(edge.source);
            }
            if(idMap.get(edge.target) !== undefined){
                edge.target = idMap.get(edge.target);
            }
        }
        return nodes.filter(node => node !== undefined);
    }

}