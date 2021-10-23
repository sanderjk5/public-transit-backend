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
    arrivalTime: number,
    departureTime?: number,
    associatedTrip?: EarliestTripInfo,
    exitTripAtStop?: number,
    round: number,
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

    // stores for each round k and each stop the earliest arrival time
    private static earliestArrivalTimePerRound: Label[][][];
    // stores the marked stops of the current round
    private static markedStops: number[];
    // stores the route-stop pairs of the marked stops
    private static Q: QEntry[];
    // stores the journey pointer for each stop
    private static j: JourneyPointerRaptor[];

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
            this.earliestArrivalTimes = ConnectionScanAlgorithmController.getEarliestArrivalTimes(req.query.sourceStop, this.sourceDate, this.minDepartureTime, this.maxArrivalTime)
            console.timeEnd('csa algorithms')
            // calculates the maximum arrival time of the alpha bounded version of the algorithm
            

            // initializes the raptor algorithm
            this.init();
            console.time('raptor meat algorithm')
            // calls the raptor
            this.performAlgorithm();
            console.timeEnd('raptor meat algorithm')
            console.log(this.earliestArrivalTimePerRound[this.earliestArrivalTimePerRound.length-1][this.sourceStops[0]])
            console.log(Converter.secondsToTime(this.earliestArrivalTimePerRound[this.earliestArrivalTimePerRound.length-1][this.sourceStops[0]][0].arrivalTime))
            console.log(Converter.secondsToTime(this.earliestArrivalTimePerRound[this.earliestArrivalTimePerRound.length-1][this.sourceStops[0]][0].departureTime))
            //McRaptorAlgorithmController.getJourneyPointersOfRaptorAlgorithm(this.sourceStops, this.targetStops, this.sourceDate, this.minDepartureTime, this.maxArrivalTime);
            // generates the http response which includes all information of the journey
            res.status(200).send();
        } catch (err) {
            console.log(err);
            res.status(500).send(err);
        }
    }

    /**
     * Performs the raptor algorithm.
     * @param targetStops 
     */
     private static performAlgorithm(){
        for(let l = this.arrivalTimesOfTarget.length-1; l >= 0; l--){
            for(let i = 0; i < this.targetStops.length; i++) {
                let targetStop = this.targetStops[i];
                let label: Label = {
                    arrivalTime: this.arrivalTimesOfTarget[l],
                    departureTime: this.arrivalTimesOfTarget[l],
                    round: 0,
                }
                this.earliestArrivalTimePerRound[0][targetStop].unshift(label);
                this.markedStops.push(targetStop);
            }
            let k = 0;
            while(true){
                // increases round counter
                // console.log(this.earliestArrivalTimePerRound[k][this.sourceStops[0]]);
                k++;
                // adds an empty array to the earliest arrival times
                this.addNextArrivalTimeRound(k);
                // fills the array of route-stop pairs
                this.fillQ();
                // traverses each route and updates earliest arrival times
                this.traverseRoutes(k);
                // updates earliest arrival times with footpaths of marked stops
                //this.handleFootpaths(k);
                // termination condition
                if(this.markedStops.length === 0){
                    break;
                }
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
        const firstRoundLabels: Label[][] = new Array(numberOfStops);
        this.earliestArrivalTimePerRound = [];
        this.markedStops = [];
        this.j = new Array(numberOfStops);

        const defaultLabel: Label = {
            arrivalTime: Number.MAX_VALUE,
            departureTime: Number.MAX_VALUE,
            round: 0,
        }
        for(let i = 0; i < numberOfStops; i++) {
            firstRoundLabels[i] = [defaultLabel];
        }

        this.arrivalTimesOfTarget = GoogleTransitData.getAllArrivalTimesOfAStopInATimeRange(this.targetStops[0], this.earliestArrivalTimeCSA, this.maxArrivalTime);
        console.log(this.arrivalTimesOfTarget.length)
        
        this.earliestArrivalTimePerRound.push(firstRoundLabels);

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
    private static addNextArrivalTimeRound(k: number) {
        if(this.earliestArrivalTimePerRound.length <= k){
            const nextRoundLabels: Label[][] = this.earliestArrivalTimePerRound[k-1];
            this.earliestArrivalTimePerRound.push(nextRoundLabels);
        } else {
            for(let pi of GoogleTransitData.STOPS){
                this.mergeBagInRoundBag(this.earliestArrivalTimePerRound[k-1][pi.id], pi.id, k)
            }
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
     * Traverses each route and updates the earliest arrival times after k changes.
     * @param k 
     * @param targetStops 
     */
    private static traverseRoutes(k: number) {
        // loop over all elements of q
        console.log(k)
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
                    routeBag = this.mergeLastRoundLabelsInRouteBag(k, r, pi, routeBag);
                    continue;
                }
                if(!reachedP){
                    continue;
                }

                routeBag = this.updateRouteBag(routeBag, pi);

                let addedLabel = this.mergeBagInRoundBag(routeBag, pi, k);
                routeBag = this.mergeLastRoundLabelsInRouteBag(k, r, pi, routeBag);
                // adds pi to the marked stops
                if(addedLabel && !this.markedStops.includes(pi)){
                    this.markedStops.push(pi);
                }
            
            }
        }
    }

    private static mergeLastRoundLabelsInRouteBag(k: number, r: number, pi: number, routeBag: Label[]){
        let lastRoundLabels = this.earliestArrivalTimePerRound[k-1][pi];
        if(lastRoundLabels.length === 0){
            return routeBag;
        }
        // first version:
        let returnedTripInfos = new Map<number, number[]>();
        for(let lastRoundLabel of lastRoundLabels){
            if(lastRoundLabel.round !== k-1 || lastRoundLabel.arrivalTime === Number.MAX_VALUE){
                continue;
            }
            let newTripInfo: EarliestTripInfo = this.getLatestTrip(r, pi, k, lastRoundLabel.departureTime);
            if(newTripInfo === null || (lastRoundLabel.associatedTrip && lastRoundLabel.associatedTrip.tripId === newTripInfo.tripId)){
                continue;
            }
            let returnedDepartureTimesOfTrip = returnedTripInfos.get(newTripInfo.tripId);
            if(returnedDepartureTimesOfTrip === undefined){
                returnedTripInfos.set(newTripInfo.tripId, [newTripInfo.tripArrival]);
            } else {
                if(returnedDepartureTimesOfTrip.includes(newTripInfo.tripArrival)){
                    continue;
                } else {
                    returnedDepartureTimesOfTrip.push(newTripInfo.tripArrival);
                    returnedTripInfos.set(newTripInfo.tripId, returnedDepartureTimesOfTrip)
                }
            }
            let newLabel: Label = {
                arrivalTime: lastRoundLabel.arrivalTime,
                associatedTrip: newTripInfo,
                exitTripAtStop: pi,
                round: k,
            }
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
                arrivalTime: label.arrivalTime,
                departureTime: departureTime,
                associatedTrip: label.associatedTrip,
                exitTripAtStop: label.exitTripAtStop,
                round: label.round,
            }
            newRouteBag.push(newLabel)
        }
        return newRouteBag;
    }

    private static mergeBagInRoundBag(bag: Label[], pi: number, k: number){
        let addedLabel = false;
        if(bag.length === 0){
            return addedLabel;
        }
        bag.sort((a, b) => {
            return b.departureTime - a.departureTime;
        })

        for(let i = 0; i < bag.length; i++){
            if(this.notDominatedInProfile(bag[i], pi, k)){
                let shiftedLabels = [];
                let currentLabel = this.earliestArrivalTimePerRound[k][pi][0];
                while(bag[i].departureTime >= currentLabel.departureTime){
                    let removedLabel = this.earliestArrivalTimePerRound[k][pi].shift()
                    shiftedLabels.push(removedLabel);
                    currentLabel = this.earliestArrivalTimePerRound[k][pi][0];
                }
                this.earliestArrivalTimePerRound[k][pi].unshift(bag[i]);
                for(let j = 0; j < shiftedLabels.length; j++) {
                    let removedLabel = shiftedLabels[j];
                    if(!this.dominates(bag[i], removedLabel)){
                        this.earliestArrivalTimePerRound[k][pi].unshift(removedLabel);
                    }
                }
                addedLabel = true;
            }
        }
        return addedLabel;
    }

    private static dominates(q: Label, p: Label): boolean {
        if(q.arrivalTime < p.arrivalTime) {
            return true;
        }
        if(q.arrivalTime === p.arrivalTime && q.departureTime > p.departureTime) {
            return true;
        }
        if(q.arrivalTime === p.arrivalTime && q.departureTime === p.departureTime && q.round <= p.round) {
            return true;
        }
        return false;
    }

    private static notDominatedInProfile(p: Label, pi: number, k: number): boolean{
        for(let q of this.earliestArrivalTimePerRound[k][pi]){
            if(this.dominates(q, p)){
                return false;
            }
        }
        return true;
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
    private static getLatestTrip(r: number, pi: number, k: number, earliestDeparture: number): EarliestTripInfo {
        let tripId: number; 
        let tripArrival: number = -1;
        let earliestTripInfo: EarliestTripInfo;
        
        let stopTimes: StopTime[] = GoogleTransitData.getStopTimesByStopAndRoute(pi, r);

        if(stopTimes.length === 0) {
            earliestTripInfo = null;
            return earliestTripInfo;
        }

        if(k > 1){
            earliestDeparture -= CHANGE_TIME;
        }

        let earliestDepartureDayOffset = Converter.getDayOffset(earliestDeparture);
        let previousDay = false;
        let currentWeekday = Calculator.moduloSeven(this.sourceWeekday + Converter.getDayDifference(earliestDeparture));
        let previousWeekday = Calculator.moduloSeven(currentWeekday - 1);
        // loops over all stop times until it finds the first departure after the earliestArrival
        for(let i = 7; i >= 0; i--) {
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

}