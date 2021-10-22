import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { RouteStopMapping } from "../../models/RouteStopMapping";
import { StopTime } from "../../models/StopTime";
import { JourneyResponse } from "../../models/JourneyResponse";
import { Section } from "../../models/Section";
import express from "express";
import { performance } from 'perf_hooks';
import { Calculator } from "../../data/calculator";
import { CHANGE_TIME, SECONDS_OF_A_DAY } from "../../constants";
import { Reliability } from "../../data/reliability";
import { JourneyPointerRaptor } from "../../models/JourneyPointerRaptor";
import { Trip } from "../../models/Trip";

// entries of the q array
interface QEntry {
    r: number,
    p: number,
    stopSequence: number
}

// stores the information about the earliest trip
interface EarliestTripInfo {
    tripId: number,
    tripDeparture: number,
    dayOffset: number,
}

interface Label {
    arrivalTime: number,
    associatedTrip?: EarliestTripInfo,
    enterTripAtStop?: number,
    round?: number,
}

export class McRaptorAlgorithmController {
    // stores for each round k and each stop the earliest arrival time
    private static earliestArrivalTimePerRound: Label[][][];
    // stores for each stop the earliest arrival time independent from the round
    private static earliestArrivalTime: Label[][];
    // stores the marked stops of the current round
    private static markedStops: number[];
    // stores the route-stop pairs of the marked stops
    private static Q: QEntry[];
    // stores the journey pointer for each stop
    private static j: JourneyPointerRaptor[];

    private static sourceWeekday: number;
    private static maxArrivalTime: number;

    public static getJourneyPointersOfRaptorAlgorithm(sourceStops: number[], targetStops: number[], sourceDate: Date, sourceTimeInSeconds: number, maxArrivalTime: number): JourneyPointerRaptor[] {
        try {
            // sets the source Weekday
            this.sourceWeekday = Calculator.moduloSeven((sourceDate.getDay() - 1));
            this.maxArrivalTime = maxArrivalTime;
            console.log(Converter.secondsToTime(maxArrivalTime));
            this.init(sourceStops, sourceTimeInSeconds);
            this.performAlgorithm(targetStops);
            console.log(this.earliestArrivalTime[targetStops[0]]);
            for(let label of this.earliestArrivalTime[targetStops[0]]){
                console.log(Converter.secondsToTime(label.arrivalTime));
            }
            // const journeyPointers: JourneyPointerRaptor[] = this.getJourneyPointers(sourceStops, targetStops);
            // return journeyPointers;
        } catch (err){
            console.log(err)
            return null;
        }
    }

    /**
     * Performs the raptor algorithm.
     * @param targetStops 
     */
    private static performAlgorithm(targetStops: number[]){
        let k = 0;
        while(true){
            // increases round counter
            k++;
            // adds an empty array to the earliest arrival times
            this.addNextArrivalTimeRound();
            // fills the array of route-stop pairs
            this.fillQ();
            // traverses each route and updates earliest arrival times
            this.traverseRoutes(k, targetStops);
            // updates earliest arrival times with footpaths of marked stops
            //this.handleFootpaths(k);
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
    private static init(sourceStops: number[], sourceTime: number){
        const numberOfStops = GoogleTransitData.STOPS.length;
        const firstRoundLabels: Label[][] = new Array(numberOfStops);
        this.earliestArrivalTimePerRound = [];
        this.earliestArrivalTime = new Array(numberOfStops);
        this.markedStops = [];
        this.j = new Array(numberOfStops);

        for(let i = 0; i < numberOfStops; i++) {
            firstRoundLabels[i] = [];
            this.earliestArrivalTime[i] = [];
        }

        // sets the source time of the source stops
        for(let i = 0; i < sourceStops.length; i++) {
            let sourceStop = sourceStops[i];
            let label: Label = {
                arrivalTime: sourceTime,
            }
            firstRoundLabels[sourceStop].push(label);
            this.earliestArrivalTime[sourceStop].push(label);
            this.markedStops.push(sourceStop);
        }
        
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
    private static addNextArrivalTimeRound() {
        const numberOfStops = GoogleTransitData.STOPS.length;
        const nextRoundLabels: Label[][] = new Array(numberOfStops)
        for(let i = 0; i < numberOfStops; i++){
            nextRoundLabels[i] = [];
        }
        this.earliestArrivalTimePerRound.push(nextRoundLabels);
    }

    /**
     * Fills the Q-Array with route-stop pairs.
     */
    private static fillQ() {
        this.Q = [];
        let qTemp: QEntry[] = [];
        // stores the first stop of each round
        let routeSequenceMinima = new Array(GoogleTransitData.ROUTES.length);
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
                if(routeSequenceMinima[routeId] === undefined || stopSequence < routeSequenceMinima[routeId]){
                    routeSequenceMinima[routeId] = stopSequence;
                }
                qTemp.push({r: routeId, p: markedStop, stopSequence: stopSequence});
            }
        }
        // uses qTemp and routeSequenceMinima to add the first route-stop pair of each route to Q
        for(let i = 0; i < qTemp.length; i++){
            let qEntry = qTemp[i];
            if(routeSequenceMinima[qEntry.r] === qEntry.stopSequence){
                this.Q.push(qEntry);
                routeSequenceMinima[qEntry.r] = - 1;
            }
        }
    }

    /**
     * Traverses each route and updates the earliest arrival times after k changes.
     * @param k 
     * @param targetStops 
     */
    private static traverseRoutes(k: number, targetStops: number[]) {
        // loop over all elements of q
        console.log(k)
        for(let i= 0; i < this.Q.length; i++){
            let r = this.Q[i].r;
            let p = this.Q[i].p;
            let routeBag: Label[] = [];
            let reachedP = false;
            // loop over all stops of r beggining with p
            for(let j = 0; j < GoogleTransitData.STOPS_OF_A_ROUTE[r].length; j++){     
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

                let addedLabel = this.mergeRouteBagInRoundBag(routeBag, pi, k);
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
        // let returnedTripInfos = new Map<number, number[]>();
        // for(let lastRoundLabel of lastRoundLabels){
        //     let newTripInfo: EarliestTripInfo = this.getEarliestTrip(r, pi, k, lastRoundLabel.arrivalTime);
        //     if(newTripInfo === null){
        //         continue;
        //     }
        //     let returnedDepartureTimesOfTrip = returnedTripInfos.get(newTripInfo.tripId);
        //     if(returnedDepartureTimesOfTrip === undefined){
        //         returnedTripInfos.set(newTripInfo.tripId, [newTripInfo.tripDeparture]);
        //     } else {
        //         if(returnedDepartureTimesOfTrip.includes(newTripInfo.tripDeparture)){
        //             continue;
        //         } else {
        //             returnedDepartureTimesOfTrip.push(newTripInfo.tripDeparture);
        //             returnedTripInfos.set(newTripInfo.tripId, returnedDepartureTimesOfTrip)
        //         }
        //     }
        //     let newLabel: Label = {
        //         arrivalTime: lastRoundLabel.arrivalTime,
        //         associatedTrip: newTripInfo,
        //         enterTripAtStop: pi,
        //     }
        //     routeBag.push(newLabel);
        // }

        // second version
        let newTripInfo: EarliestTripInfo = this.getEarliestTrip(r, pi, k, lastRoundLabels[0].arrivalTime);
        if(newTripInfo === null){
            return routeBag;
        }
        if(lastRoundLabels.length === 1 && lastRoundLabels[0].associatedTrip && lastRoundLabels[0].associatedTrip.tripId === newTripInfo.tripId){
            return routeBag;
        }
        let newLabel: Label = {
            arrivalTime: lastRoundLabels[0].arrivalTime,
            associatedTrip: newTripInfo,
            enterTripAtStop: pi,
            round: k,
        }
        routeBag.push(newLabel);
        return routeBag;
    }

    private static updateRouteBag(routeBag: Label[], pi: number){
        let newRouteBag: Label[] = [];
        for(let label of routeBag){
            let stopTime = GoogleTransitData.getStopTimeByTripAndStop(label.associatedTrip.tripId, pi);
            let arrivalTime = stopTime.arrivalTime + label.associatedTrip.dayOffset;
            let departureTime = stopTime.departureTime + label.associatedTrip.dayOffset;
            if(arrivalTime < label.associatedTrip.tripDeparture){
                arrivalTime += SECONDS_OF_A_DAY;
            }
            if(departureTime < label.associatedTrip.tripDeparture){
                departureTime += SECONDS_OF_A_DAY;
            }
            let newLabel: Label = {
                arrivalTime: arrivalTime,
                associatedTrip: label.associatedTrip,
                enterTripAtStop: label.enterTripAtStop,
                round: label.round,
            }
            newRouteBag.push(newLabel)
        }
        return newRouteBag;
    }

    private static mergeRouteBagInRoundBag(routeBag: Label[], pi: number, k: number){
        let addedLabel = false;
        if(routeBag.length === 0){
            return addedLabel;
        }
        routeBag.sort((a, b) => {
            return a.arrivalTime - b.arrivalTime;
        })
        let earliestArrivalTime = routeBag[0].arrivalTime;
        if(earliestArrivalTime > this.maxArrivalTime){
            return addedLabel;
        }
        if (this.earliestArrivalTime[pi].length > 0 && earliestArrivalTime < this.earliestArrivalTime[pi][0].arrivalTime){
            this.earliestArrivalTimePerRound[k][pi] = [];
            this.earliestArrivalTime[pi] = [];
        }
        if(this.earliestArrivalTime[pi].length === 0 || earliestArrivalTime === this.earliestArrivalTime[pi][0].arrivalTime){
            for(let i = 0; i < routeBag.length; i++){
                if(routeBag[i].arrivalTime === earliestArrivalTime){
                    addedLabel = true;
                    this.earliestArrivalTimePerRound[k][pi].push(routeBag[i]);
                    this.earliestArrivalTime[pi].push(routeBag[i]);
                } else {
                    break;
                }
            }
        } 
        return addedLabel;
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
    private static getEarliestTrip(r: number, pi: number, k: number, earliestArrival: number): EarliestTripInfo {
        let tripId: number; 
        let tripDeparture: number = Number.MAX_VALUE;
        let earliestTripInfo: EarliestTripInfo;
        
        let stopTimes: StopTime[] = GoogleTransitData.getStopTimesByStopAndRoute(pi, r);

        if(stopTimes.length === 0) {
            earliestTripInfo = null;
            return earliestTripInfo;
        }

        if(k > 1){
            earliestArrival += CHANGE_TIME;
        }

        let earliestArrivalDayOffset = Converter.getDayOffset(earliestArrival);
        let previousDay = false;
        let currentWeekday = Calculator.moduloSeven(this.sourceWeekday + Converter.getDayDifference(earliestArrival));
        let previousWeekday = Calculator.moduloSeven(currentWeekday - 1);
        // loops over all stop times until it finds the first departure after the earliestArrival
        for(let i = 0; i < 8; i ++) {
            for(let j = 0; j < stopTimes.length; j++) {
                let stopTime = stopTimes[j];
                let departureTime = stopTime.departureTime;
                let serviceId = GoogleTransitData.TRIPS[stopTime.tripId].serviceId;
                // checks if the trip is available and if it is a candidat for the earliest trip
                if(GoogleTransitData.CALENDAR[serviceId].isAvailable[currentWeekday] && (departureTime + earliestArrivalDayOffset) >= earliestArrival 
                    && (departureTime + earliestArrivalDayOffset) < tripDeparture) {
                    tripId = stopTime.tripId;
                    tripDeparture = departureTime + earliestArrivalDayOffset;
                    previousDay = false;
                }
                // checks if the trip corresponds to the previous day but could be catched at the current day
                let departureTimeOfPreviousDay = departureTime - SECONDS_OF_A_DAY;
                if(GoogleTransitData.CALENDAR[serviceId].isAvailable[previousWeekday] && departureTimeOfPreviousDay >= 0 
                    && (departureTimeOfPreviousDay + earliestArrivalDayOffset) >= earliestArrival && (departureTimeOfPreviousDay + earliestArrivalDayOffset) < tripDeparture){
                    tripId = stopTime.tripId;
                    tripDeparture = departureTimeOfPreviousDay + earliestArrivalDayOffset;
                    previousDay = true;
                }
            }
            if(tripId !== undefined){
                break;
            }
            previousWeekday = currentWeekday;
            currentWeekday = Calculator.moduloSeven(currentWeekday + 1);
            earliestArrivalDayOffset += SECONDS_OF_A_DAY;
        }
        
        
        if(tripId !== undefined){
            // checks if it found a trip at the same day
            let dayOffset: number;
            if(previousDay) {
                dayOffset = earliestArrivalDayOffset-SECONDS_OF_A_DAY;
            } else {
                dayOffset = earliestArrivalDayOffset;
            }
            // updates the earliest trip information
            earliestTripInfo = {
                tripId: tripId,
                tripDeparture: tripDeparture,
                dayOffset: dayOffset,
            }
        } else {
            // return null if there are no stop times at this stop
            earliestTripInfo = null
        }
        
        return earliestTripInfo;
    }

    // private static getJourneyPointers(sourceStops: number[], targetStops: number[]){
    //     // finds the earliest arrival at the target stops
    //     let earliestTargetStopArrival = this.earliestArrivalTime[targetStops[0]];
    //     let earliestTargetStopId = targetStops[0];
    //     for(let i = 1; i < targetStops.length; i++){
    //         if(this.earliestArrivalTime[targetStops[i]] < earliestTargetStopArrival){
    //             earliestTargetStopArrival = this.earliestArrivalTime[targetStops[i]];
    //             earliestTargetStopId = targetStops[i];
    //         }
    //     }

    //     if(earliestTargetStopArrival === Number.MAX_VALUE){
    //         throw new Error("Couldn't find a connection.");
    //     }

    //     // reconstructs the journey pointers from target to source stop
    //     let journeyPointers: JourneyPointerRaptor[] = []
    //     let stopId = earliestTargetStopId;
    //     while(!sourceStops.includes(stopId)){
    //         this.j[stopId].exitTripAtStop = stopId;
    //         journeyPointers.unshift(this.j[stopId]);
    //         stopId = this.j[stopId].enterTripAtStop;
    //     }
    //     return journeyPointers;
    // }
}