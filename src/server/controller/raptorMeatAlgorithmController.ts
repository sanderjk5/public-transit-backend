import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { RouteStopMapping } from "../../models/RouteStopMapping";
import { StopTime } from "../../models/StopTime";
import { JourneyResponse } from "../../models/JourneyResponse";
import { Section } from "../../models/Section";
import express from "express";
import { performance } from 'perf_hooks';
import { Calculator } from "../../data/calculator";
import { MAX_D_C_LONG, MAX_D_C_NORMAL, SECONDS_OF_A_DAY } from "../../constants";
import { Reliability } from "../../data/reliability";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";

// entries of the q array
interface QEntry {
    r: number,
    p: number,
    stopSequence: number
}

// stores the information about the earliest trip
interface TripInfo {
    tripId: number,
    tripDeparture: number,
    dayOffset: number,
}

interface EarliestArrivalEntry {
    arrivalTime: number,
    tripId: number,
}

// can be used to reconstruct the journey
interface JourneyPointer {
    enterTripAtStop: number,
    exitTripAtStop?: number,
    departureTime: number,
    arrivalTime: number,
    tripId: number,
    footpath: number,
}

export class RaptorMeatAlgorithmController {
    // stores for each round k and each stop the earliest arrival time
    private static earliestArrivalTimePerRound: EarliestArrivalEntry[][][];
    // stores for each stop the earliest arrival time independent from the round
    private static earliestArrivalTime: EarliestArrivalEntry[][];
    // stores the marked stops of the current round
    private static markedStops: number[];
    // stores the route-stop pairs of the marked stops
    private static Q: QEntry[];
    // stores the journey pointer for each stop
    private static j: JourneyPointer[];

    private static sourceStops: number[];
    private static targetStops: number[];

    private static minDepartureTime: number;
    private static earliestSafeArrivalTime: number;
    private static maxArrivalTime: number;

    private static sourceWeekday: number;
    private static sourceDate: Date;

    /**
     * Initializes and calls the algorithm.
     * @param req 
     * @param res 
     * @returns 
     */
    public static raptorMeatAlgorithm(req: express.Request, res: express.Response){
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

            this.earliestSafeArrivalTime = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, true);
            if(this.earliestSafeArrivalTime === null) {
                throw new Error("Couldn't find a connection.")
            }

            // calculates the maximum arrival time of the alpha bounded version of the algorithm
            this.maxArrivalTime = this.earliestSafeArrivalTime + 1 * (this.earliestSafeArrivalTime - this.minDepartureTime);

            // initializes the raptor algorithm
            this.init();
            console.time('raptor algorithm')
            // calls the raptor
            this.performAlgorithm();
            console.timeEnd('raptor algorithm')
            // generates the http response which includes all information of the journey
            // const journeyResponse = this.getJourneyResponse();
            // res.status(200).send(journeyResponse);
            res.status(200).send();
        } catch (err) {
            res.status(500).send(err);
        }
    }

    /**
     * Performs the raptor algorithm.
     * @param targetStops 
     */
    private static performAlgorithm(){
        let k = 0;
        while(true){
            // increases round counter
            k++;
            // adds an empty array to the earliest arrival times
            this.addNextArrivalTimeRound();
            // fills the array of route-stop pairs
            this.fillQ();
            // traverses each route and updates earliest arrival times
            this.traverseRoutes(k);
            // updates earliest arrival times with footpaths of marked stops
            // this.handleFootpaths(k);
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
        const numberOfStops = GoogleTransitData.STOPS.length;
        const firstRoundTimes: EarliestArrivalEntry[][] = new Array(numberOfStops);
        this.earliestArrivalTimePerRound = [];
        this.earliestArrivalTime = new Array(numberOfStops);
        this.markedStops = [];
        this.j = new Array(numberOfStops);

        for(let i = 0; i < numberOfStops; i++) {
            firstRoundTimes[i] = [];
            this.earliestArrivalTime[i] = [];
        }

        let defaultEntry: EarliestArrivalEntry = {
            arrivalTime: this.minDepartureTime,
            tripId: undefined,
        };
        // sets the source time of the source stops
        for(let i = 0; i < this.sourceStops.length; i++) {
            let sourceStop = this.sourceStops[i];
            firstRoundTimes[sourceStop].push(defaultEntry);
            this.earliestArrivalTime[sourceStop].push(defaultEntry);
            this.markedStops.push(sourceStop);
        }
        
        this.earliestArrivalTimePerRound.push(firstRoundTimes);

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
        const nextRoundTimes = new Array(numberOfStops);
        for(let i = 0; i < numberOfStops; i++){
            nextRoundTimes[i] = Number.MAX_VALUE;
        }
        this.earliestArrivalTimePerRound.push(nextRoundTimes);
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
    private static traverseRoutes(k: number) {
        // loop over all elements of q
        for(let i= 0; i < this.Q.length; i++){
            let r = this.Q[i].r;
            let p = this.Q[i].p;
            // get the earliest trip or r which can be catched at p in round k
            
            // if(!t){
            //     continue;
            // }
            let reachedP = false;
            let tripInfos = this.getRelevantTrips(r, p, k);
            // loop over all stops of r beggining with p
            for(let j = 0; j < GoogleTransitData.STOPS_OF_A_ROUTE[r].length; j++){     
                let pi = GoogleTransitData.STOPS_OF_A_ROUTE[r][j];
                if(pi === p){
                    reachedP = true;
                }
                if(!reachedP){
                    continue;
                }

                if(pi !== p && this.earliestArrivalTimePerRound[k-1][pi].length > 0){
                    tripInfos = this.getRelevantTrips(r, pi, k);
                }
                for(let i = 0; i < tripInfos.length; i++){
                    let tripInfo = tripInfos[i];
                    let t = tripInfo.tripId;
                    let dayOffset = tripInfo.dayOffset;
                    let enterTripAtStop = p;
    
                    // gets stop time of stop pi in trip t
                    let stopTime = GoogleTransitData.getStopTimeByTripAndStop(t, pi);
    
                    if(!stopTime){
                        continue;
                    }
    
                    // sets the arrival and departure time at stop pi
                    let arrivalTime = stopTime.arrivalTime + dayOffset;
                    let departureTime = stopTime.departureTime + dayOffset;
                    if(arrivalTime < tripInfo.tripDeparture){
                        arrivalTime += SECONDS_OF_A_DAY;
                    }
                    if(departureTime < tripInfo.tripDeparture){
                        departureTime += SECONDS_OF_A_DAY;
                    }
    
                    // sets the arrival time + journey pointer
                    if(stopTime && arrivalTime < this.maxArrivalTime){
                        let arrivaltTimeEntry: EarliestArrivalEntry = {
                            arrivalTime: arrivalTime,
                            tripId: t,
                        }
                        this.earliestArrivalTimePerRound[k][pi].push(arrivaltTimeEntry);
                        this.earliestArrivalTime[pi].push(arrivaltTimeEntry);
                        // this.j[pi] = {
                        //     enterTripAtStop: enterTripAtStop,
                        //     departureTime: tripInfo.tripDeparture,
                        //     arrivalTime: arrivalTime,
                        //     tripId: t,
                        //     footpath: null
                        // }
                        // adds pi to the marked stops
                        if(!this.markedStops.includes(pi)){
                            this.markedStops.push(pi);
                        }
                    }
                }
                
                
                // checks if it is possible to catch an earlier trip at pi in round k
                // if(stopTime){
                //     let newT = this.getRelevantTrips(r, pi, k);
                //     if(t !== newT.tripId || dayOffset !== newT.dayOffset){
                //         tripInfo = newT;
                //         t = tripInfo.tripId;
                //         enterTripAtStop = stopTime.stopId;
                //         dayOffset = tripInfo.dayOffset;
                //     }
                // }
            }
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
    private static getRelevantTrips(r: number, pi: number, k: number): TripInfo[] {
        let stopTimes: StopTime[] = GoogleTransitData.getStopTimesByStopAndRoute(pi, r);
        let tripInfos = []
        if(stopTimes.length === 0) {
            return tripInfos;
        }

        let trips: number[] = [];

        let earliestArrivals = this.earliestArrivalTimePerRound[k-1][pi];
        for(let i = 0; i < earliestArrivals.length; i++){
            let tripDeparture: number = Number.MAX_VALUE;

            let earliestArrival = this.earliestArrivalTimePerRound[k-1][pi][i];
            let earliestArrivalTime = earliestArrival.arrivalTime;
            let earliestArrivalDayOffset = Converter.getDayOffset(earliestArrivalTime);

            let currentWeekday = Calculator.moduloSeven(this.sourceWeekday + Converter.getDayDifference(earliestArrivalTime));
            let previousWeekday = Calculator.moduloSeven(currentWeekday - 1);

            let currentMaxDelay = MAX_D_C_NORMAL;
            if(earliestArrival.tripId !== undefined && GoogleTransitData.TRIPS[earliestArrival.tripId].isLongDistance){
                currentMaxDelay = MAX_D_C_LONG;
            }

            let foundAllTrips = false;

            // loops over all stop times until it finds the first departure after the earliestArrival
            for(let j = 0; j < 8; j ++) {
                for(let k = 0; k < stopTimes.length; k++) {
                    let stopTime = stopTimes[k];
                    let departureTime = stopTime.departureTime;
                    let serviceId = GoogleTransitData.TRIPS[stopTime.tripId].serviceId;
                    let tripInfo: TripInfo;
                    // checks if the trip is available and if it is a candidat for the earliest trip
                    if(GoogleTransitData.CALENDAR[serviceId].isAvailable[currentWeekday] && (departureTime + earliestArrivalDayOffset) >= earliestArrivalTime 
                        && (departureTime + earliestArrivalDayOffset) < tripDeparture) {
                        tripInfo = {
                            tripId: stopTime.tripId,
                            tripDeparture: departureTime + earliestArrivalDayOffset,
                            dayOffset: earliestArrivalDayOffset,
                        }
                    }
                    // checks if the trip corresponds to the previous day but could be catched at the current day
                    let departureTimeOfPreviousDay = departureTime - SECONDS_OF_A_DAY;
                    if(GoogleTransitData.CALENDAR[serviceId].isAvailable[previousWeekday] && departureTimeOfPreviousDay >= 0 
                        && (departureTimeOfPreviousDay + earliestArrivalDayOffset) >= earliestArrivalTime && (departureTimeOfPreviousDay + earliestArrivalDayOffset) < tripDeparture){
                        tripInfo = {
                            tripId: stopTime.tripId,
                            tripDeparture: departureTimeOfPreviousDay + earliestArrivalDayOffset,
                            dayOffset: earliestArrivalDayOffset-SECONDS_OF_A_DAY,
                        }
                    }
                    if(tripInfo !== undefined){
                        if(!trips.includes(tripInfo.tripId)){
                            tripInfos.push(tripInfo);
                        }
                        if(earliestArrival.tripId === undefined || tripInfo.tripDeparture > earliestArrivalTime + currentMaxDelay){
                            foundAllTrips = true;
                            break;
                        }
                    }
                }
                if(foundAllTrips){
                    break;
                }
                previousWeekday = currentWeekday;
                currentWeekday = Calculator.moduloSeven(currentWeekday + 1);
                earliestArrivalDayOffset += SECONDS_OF_A_DAY;
            }
        }
        return tripInfos;
    }

    /**
     * Uses the journey pointers to generate the journey response of the http request.
     * @param sourceStops 
     * @param targetStops 
     * @param initialDate 
     * @returns 
     */
    // private static getJourneyResponse(): JourneyResponse {
    //     // finds the earliest arrival at the target stops
    //     let earliestTargetStopArrival = this.earliestArrivalTime[this.targetStops[0]];
    //     let earliestTargetStopId = this.targetStops[0];
    //     for(let i = 1; i < this.targetStops.length; i++){
    //         if(this.earliestArrivalTime[this.targetStops[i]] < earliestTargetStopArrival){
    //             earliestTargetStopArrival = this.earliestArrivalTime[this.targetStops[i]];
    //             earliestTargetStopId = this.targetStops[i];
    //         }
    //     }

    //     if(earliestTargetStopArrival === Number.MAX_VALUE){
    //         throw new Error("Couldn't find a connection.");
    //     }

    //     // reconstructs the journey pointers from target to source stop
    //     let journeyPointers: JourneyPointer[] = []
    //     let stopId = earliestTargetStopId;
    //     while(!this.sourceStops.includes(stopId)){
    //         this.j[stopId].exitTripAtStop = stopId;
    //         journeyPointers.push(this.j[stopId]);
    //         stopId = this.j[stopId].enterTripAtStop;
    //     }

    //     let reliability = 1;
    //     let lastTripId = null;
    //     let lastArrivalTime = null;
        
    //     // generates the sections
    //     const sections: Section[] = []
    //     let numberOfLegs = 0;
    //     for(let i = (journeyPointers.length - 1); i >= 0; i--){
    //         let departureTime = journeyPointers[i].departureTime;
    //         let arrivalTime = journeyPointers[i].arrivalTime;
    //         let arrivalStop = journeyPointers[i].exitTripAtStop;
    //         let type = 'Train'
    //         if(journeyPointers[i].footpath !== null) {
    //             type = 'Footpath'
    //         } else {
    //             if(lastArrivalTime !== null && lastTripId !== null) {
    //                 reliability *= Reliability.getReliability(-1, departureTime - lastArrivalTime, GoogleTransitData.TRIPS[lastTripId].isLongDistance);
    //             }
    //             lastTripId = journeyPointers[i].tripId;
    //             numberOfLegs++;
    //         }
    //         let section: Section = {
    //             departureTime: Converter.secondsToTime(departureTime),
    //             arrivalTime: Converter.secondsToTime(arrivalTime),
    //             departureStop: GoogleTransitData.STOPS[journeyPointers[i].enterTripAtStop].name,
    //             arrivalStop: GoogleTransitData.STOPS[arrivalStop].name,
    //             duration: Converter.secondsToTime((arrivalTime - departureTime)),
    //             type: type
    //         }

    //         lastArrivalTime = arrivalTime;
            
    //         if(i === 0 && section.departureStop === section.arrivalStop){
    //             break;
    //         }
    //         sections.push(section);

    //         if(i > 0){
    //             let nextDepartureStop = journeyPointers[i-1].enterTripAtStop;
    //             // raptor doesn't saves changes at stops. create them as footpath with a duration of 0 seconds.
    //             if(arrivalStop === nextDepartureStop && type === 'Train' && journeyPointers[i-1].footpath === null){
    //                 let stopName = GoogleTransitData.STOPS[nextDepartureStop].name;
    //                 let section: Section = {
    //                     departureTime: Converter.secondsToTime(arrivalTime),
    //                     arrivalTime: Converter.secondsToTime(arrivalTime),
    //                     departureStop: stopName,
    //                     arrivalStop: stopName,
    //                     duration: Converter.secondsToTime(0),
    //                     type: 'Footpath'
    //                 }
    //                 sections.push(section);
    //             }
    //         }
    //     }

    //     reliability = Math.floor(reliability * 100);

    //     // calculates departure and arrival date
    //     let departureDate = new Date(this.sourceDate);
    //     let arrivalDate = new Date(this.sourceDate);
    //     departureDate.setDate(this.sourceDate.getDate() + Converter.getDayDifference(journeyPointers[journeyPointers.length-1].departureTime))
    //     arrivalDate.setDate(this.sourceDate.getDate() + Converter.getDayDifference(journeyPointers[0].arrivalTime))
    //     let departureDateAsString = departureDate.toLocaleDateString('de-DE');
    //     let arrivalDateAsString = arrivalDate.toLocaleDateString('de-DE');

    //     // creates the journey response
    //     const journeyResponse: JourneyResponse = {
    //         sourceStop: sections[0].departureStop,
    //         targetStop: sections[sections.length-1].arrivalStop,
    //         departureTime: sections[0].departureTime,
    //         arrivalTime: sections[sections.length-1].arrivalTime,
    //         departureDate: departureDateAsString,
    //         arrivalDate: arrivalDateAsString,
    //         changes: Math.max(numberOfLegs - 1, 0),
    //         reliability: reliability.toString() + '%',
    //         sections: sections
    //     }
    //     return journeyResponse;
    // }
}