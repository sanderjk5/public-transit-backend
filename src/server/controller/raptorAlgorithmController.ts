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

export class RaptorAlgorithmController {
    // source and target stop
    private static sourceStop: number;
    private static targetStop: number;

    // round counter
    private static k: number;

    // source time and date
    private static sourceTime: number;
    private static sourceDate: Date;

    // stores for each round k and each stop the earliest arrival time
    private static earliestArrivalTimePerRound: number[][];
    // stores for each stop the earliest arrival time independent from the round
    private static earliestArrivalTime: number[];
    // stores the marked stops of the current round
    private static markedStops: number[];
    // stores the route-stop pairs of the marked stops
    private static Q: QEntry[];
    // stores the journey pointer for each stop
    private static j: JourneyPointerRaptor[];

    private static sourceWeekday: number;

    /**
     * Initializes and calls the algorithm.
     * @param req 
     * @param res 
     * @returns 
     */
    public static raptorAlgorithm(req: express.Request, res: express.Response){
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
            this.sourceTime = Converter.timeToSeconds(req.query.sourceTime)
            this.sourceDate = new Date(req.query.date);
            this.sourceWeekday = Calculator.moduloSeven((this.sourceDate.getDay() - 1));
            // initializes the csa algorithm
            this.init();
            console.time('raptor algorithm')
            // calls the csa
            this.performAlgorithm();
            console.timeEnd('raptor algorithm')
            // generates the http response which includes all information of the journey
            const journeyResponse = this.getJourneyResponse();
            res.status(200).send(journeyResponse);
        } catch (err) {
            // console.log(err)
            res.status(500).send(err);
        }
    }

    /**
     * Calls the raptor algorithm. Can be used by the random request test.
     * @param sourceStop 
     * @param targetStop 
     * @param sourceDate 
     * @param sourceTimeInSeconds 
     * @returns 
     */
    public static testAlgorithm(sourceStop: string, targetStop: string, sourceDate: Date, sourceTimeInSeconds: number){
        // gets the source and target stops
        this.sourceStop = GoogleTransitData.getStopIdByName(sourceStop);
        this.targetStop = GoogleTransitData.getStopIdByName(targetStop);
        this.sourceTime = sourceTimeInSeconds;
        this.sourceDate = sourceDate;
        // sets the source Weekday
        this.sourceWeekday = Calculator.moduloSeven((this.sourceDate.getDay() - 1));
        try {
            // initializes the csa algorithm
            this.init();
            const startTime = performance.now();
            // calls the csa
            this.performAlgorithm();
            const duration = performance.now() - startTime;
            // gets the earliest arrival time at the target stops
            let earliestTargetStopArrival = this.earliestArrivalTime[this.targetStop];
            if(earliestTargetStopArrival === Number.MAX_VALUE){
                throw new Error('invalid time');
            }
            return {arrivalTime: earliestTargetStopArrival, duration: duration};
        } catch (err) {
            return null;
        }
    }

    /**
     * Performs the raptor algorithm.
     */
    private static performAlgorithm(){
        this.k = 0;
        while(true){
            // increases round counter
            this.k++;
            // adds an empty array to the earliest arrival times
            this.addNextArrivalTimeRound();
            // fills the array of route-stop pairs
            this.fillQ();
            // traverses each route and updates earliest arrival times
            this.traverseRoutes();
            // updates earliest arrival times with footpaths of marked stops
            // this.handleFootpaths();
            // termination condition
            if(this.markedStops.length === 0){
                break;
            }
        }
    }

    /**
     * Initializes the required arrays.
     * @param sourceStop 
     * @param sourceTime 
     */
    private static init(){
        const numberOfStops = GoogleTransitData.STOPS.length;
        const firstRoundTimes = new Array(numberOfStops);
        this.earliestArrivalTimePerRound = [];
        this.earliestArrivalTime = new Array(numberOfStops);
        this.markedStops = [];
        this.j = new Array(numberOfStops);

        for(let i = 0; i < numberOfStops; i++) {
            firstRoundTimes[i] = Number.MAX_VALUE;
            this.earliestArrivalTime[i] = Number.MAX_VALUE;
        }

        // sets the source time of the source stop
        firstRoundTimes[this.sourceStop] = this.sourceTime;
        this.earliestArrivalTime[this.sourceStop] = this.sourceTime;
        this.markedStops.push(this.sourceStop);
        
        this.earliestArrivalTimePerRound.push(firstRoundTimes);

        // updates the footpaths of the source stops
        let sourceFootpaths = GoogleTransitData.getAllFootpathsOfADepartureStop(this.sourceStop);
        for(let j = 0; j < sourceFootpaths.length; j++){
            let p = sourceFootpaths[j].departureStop;
            let pN = sourceFootpaths[j].arrivalStop;
            if(p !== pN && this.earliestArrivalTimePerRound[0][pN] > (this.earliestArrivalTimePerRound[0][p] + sourceFootpaths[j].duration)){
                this.earliestArrivalTimePerRound[0][pN] = this.earliestArrivalTimePerRound[0][p] + sourceFootpaths[j].duration;
                if(!this.markedStops.includes(pN)){
                    this.markedStops.push(pN);
                }
                if(this.earliestArrivalTimePerRound[0][pN] < this.earliestArrivalTime[pN]){
                    this.earliestArrivalTime[pN] = this.earliestArrivalTimePerRound[0][pN];
                    this.j[pN] = {
                        enterTripAtStop: p,
                        departureTime: this.earliestArrivalTimePerRound[0][p],
                        arrivalTime: this.earliestArrivalTime[pN],
                        tripId: null,
                        footpath: sourceFootpaths[j].id
                    }
                }
            }
        }
    }

    /**
     * Adds an empty array to the earliestArrivalTimePerRound array which can be used in the next round.
     */
    private static addNextArrivalTimeRound() {
        const numberOfStops = GoogleTransitData.STOPS.length;
        const nextRoundTimes = new Array(numberOfStops)
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
     * @param targetStop 
     */
    private static traverseRoutes() {
        // loop over all elements of q
        for(let i= 0; i < this.Q.length; i++){
            let r = this.Q[i].r;
            let p = this.Q[i].p;
            // get the earliest trip or r which can be catched at p in round k
            let tripInfo = this.getEarliestTrip(r, p);
            let t = tripInfo.tripId;
            let dayOffset = tripInfo.dayOffset;
            let enterTripAtStop = p;
            if(!t){
                continue;
            }
            let reachedP = false;
            // loop over all stops of r beggining with p
            for(let j = 0; j < GoogleTransitData.STOPS_OF_A_ROUTE[r].length; j++){     
                let pi = GoogleTransitData.STOPS_OF_A_ROUTE[r][j];
                if(pi === p){
                    reachedP = true;
                    continue;
                }
                if(!reachedP){
                    continue;
                }

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

                // gets the earliest arrival time at the target stops
                let earliestTargetStopArrival = this.earliestArrivalTime[this.targetStop];
                // sets the arrival time + journey pointer
                if(stopTime && arrivalTime < Math.min(this.earliestArrivalTime[pi], earliestTargetStopArrival)){
                    this.earliestArrivalTimePerRound[this.k][pi] = arrivalTime;
                    this.earliestArrivalTime[pi] = arrivalTime;
                    this.j[pi] = {
                        enterTripAtStop: enterTripAtStop,
                        departureTime: tripInfo.tripDeparture,
                        arrivalTime: arrivalTime,
                        tripId: t,
                        footpath: null
                    }
                    // adds pi to the marked stops
                    if(!this.markedStops.includes(pi)){
                        this.markedStops.push(pi);
                    }
                }
                
                // checks if it is possible to catch an earlier trip at pi in round k
                if(stopTime && this.earliestArrivalTimePerRound[this.k-1][pi] + CHANGE_TIME < departureTime){
                    let newT = this.getEarliestTrip(r, pi);
                    if(t !== newT.tripId || dayOffset !== newT.dayOffset){
                        tripInfo = newT;
                        t = tripInfo.tripId;
                        enterTripAtStop = stopTime.stopId;
                        dayOffset = tripInfo.dayOffset;
                    }
                }
            }
        }
    }

    /**
     * Uses the footpaths to update the earliest arrival times.
     * @param k 
     */
    private static handleFootpaths() {
        // uses the arrival times before they are updated by footpaths
        let numberOfMarkedStops = this.markedStops.length;
        let arrivalTimesInRoundK = [];
        for(let i = 0; i < numberOfMarkedStops; i++){
            let markedStop = this.markedStops[i];
            arrivalTimesInRoundK.push(this.earliestArrivalTimePerRound[this.k][markedStop])
        }

        // loop over all marked stops
        for(let i = 0; i < numberOfMarkedStops; i++){
            let markedStop = this.markedStops[i];
            let arrivalTimeOfMarkedStop = arrivalTimesInRoundK[i];
            let footPaths = GoogleTransitData.getAllFootpathsOfADepartureStop(markedStop);
            for(let j = 0; j < footPaths.length; j++){
                let p = footPaths[j].departureStop;
                let pN = footPaths[j].arrivalStop;
                // checks if the footpath minimizes the arrival time in round k
                if(p !== pN && this.earliestArrivalTimePerRound[this.k][pN] > (arrivalTimeOfMarkedStop + footPaths[j].duration)){
                    this.earliestArrivalTimePerRound[this.k][pN] = arrivalTimeOfMarkedStop + footPaths[j].duration;
                    if(!this.markedStops.includes(pN)){
                        this.markedStops.push(pN);
                    }
                    // checks if the new arrival time is smaller than the overall earliest arrival time
                    if(this.earliestArrivalTimePerRound[this.k][pN] < this.earliestArrivalTime[pN]){
                        this.earliestArrivalTime[pN] = this.earliestArrivalTimePerRound[this.k][pN];
                        // updates the journey pointer
                        this.j[pN] = {
                            enterTripAtStop: p,
                            departureTime: arrivalTimeOfMarkedStop,
                            arrivalTime: this.earliestArrivalTime[pN],
                            tripId: null,
                            footpath: footPaths[j].id
                        }
                    }
                }
            }
        }
    }

    /**
     * Gets the earliest trip of route r which can be catched at stop pi in round k.
     * @param r 
     * @param pi 
     * @param k 
     * @returns 
     */
    private static getEarliestTrip(r: number, pi: number): EarliestTripInfo {
        let tripId: number; 
        let tripDeparture: number = Number.MAX_VALUE;
        let earliestTripInfo: EarliestTripInfo;
        
        let stopTimes: StopTime[] = GoogleTransitData.getStopTimesByStopAndRoute(pi, r);

        if(stopTimes.length === 0) {
            earliestTripInfo = {
                tripId: null,
                tripDeparture: null,
                dayOffset: null,
            }
            return earliestTripInfo;
        }

        let earliestArrival = this.earliestArrivalTimePerRound[this.k-1][pi];
        if(this.k > 1){
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
                // checks if the trip is available and if it is a candidat for the earliest trip
                if(GoogleTransitData.isAvailable(currentWeekday, GoogleTransitData.TRIPS[stopTime.tripId].isAvailable) && (departureTime + earliestArrivalDayOffset) >= earliestArrival 
                    && (departureTime + earliestArrivalDayOffset) < tripDeparture) {
                    tripId = stopTime.tripId;
                    tripDeparture = departureTime + earliestArrivalDayOffset;
                    previousDay = false;
                }
                // checks if the trip corresponds to the previous day but could be catched at the current day
                let departureTimeOfPreviousDay = departureTime - SECONDS_OF_A_DAY;
                if(GoogleTransitData.isAvailable(previousWeekday, GoogleTransitData.TRIPS[stopTime.tripId].isAvailable) && departureTimeOfPreviousDay >= 0 
                    && (departureTimeOfPreviousDay + earliestArrivalDayOffset) >= earliestArrival && (departureTimeOfPreviousDay + earliestArrivalDayOffset) < tripDeparture){
                    tripId = stopTime.tripId;
                    tripDeparture = departureTimeOfPreviousDay + earliestArrivalDayOffset;
                    previousDay = true;
                }
            }
            if(tripId){
                break;
            }
            previousWeekday = currentWeekday;
            currentWeekday = Calculator.moduloSeven(currentWeekday + 1);
            earliestArrivalDayOffset += SECONDS_OF_A_DAY;
        }
        
        
        if(tripId){
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
            earliestTripInfo = {
                tripId: null,
                tripDeparture: null,
                dayOffset: null,
            }
        }
        
        return earliestTripInfo;
    }

    private static getJourneyPointers(){
        // finds the earliest arrival at the target stops
        let earliestTargetStopArrival = this.earliestArrivalTime[this.targetStop];

        if(earliestTargetStopArrival === Number.MAX_VALUE){
            throw new Error("Couldn't find a connection.");
        }

        // reconstructs the journey pointers from target to source stop
        let journeyPointers: JourneyPointerRaptor[] = []
        let stopId = this.targetStop;
        while(this.sourceStop !== stopId){
            this.j[stopId].exitTripAtStop = stopId;
            journeyPointers.unshift(this.j[stopId]);
            stopId = this.j[stopId].enterTripAtStop;
        }
        return journeyPointers;
    }

    /**
     * Uses the journey pointers to generate the journey response of the http request.
     * @param sourceStop 
     * @param targetStop 
     * @param initialDate 
     * @returns 
     */
    private static getJourneyResponse(): JourneyResponse {
        const journeyPointers = this.getJourneyPointers();

        let reliability = 1;
        let lastTripId = null;
        let lastArrivalTime = null;
        
        // generates the sections
        const sections: Section[] = []
        let numberOfLegs = 0;
        for(let i = 0; i < journeyPointers.length; i++){
            let departureTime = journeyPointers[i].departureTime;
            let arrivalTime = journeyPointers[i].arrivalTime;
            let arrivalStop = journeyPointers[i].exitTripAtStop;
            let type = 'Train'
            if(journeyPointers[i].footpath !== null) {
                type = 'Footpath'
            } else {
                if(lastArrivalTime !== null && lastTripId !== null) {
                    reliability *= Reliability.getProbabilityOfArrivalTime(-1, departureTime - lastArrivalTime, GoogleTransitData.TRIPS[lastTripId].isLongDistance);
                }
                lastTripId = journeyPointers[i].tripId;
                numberOfLegs++;
            }
            let section: Section = {
                departureTime: Converter.secondsToTime(departureTime),
                arrivalTime: Converter.secondsToTime(arrivalTime),
                departureStop: GoogleTransitData.STOPS[journeyPointers[i].enterTripAtStop].name,
                arrivalStop: GoogleTransitData.STOPS[arrivalStop].name,
                duration: Converter.secondsToTime((arrivalTime - departureTime)),
                type: type
            }

            lastArrivalTime = arrivalTime;
            
            if(i === journeyPointers.length-1 && section.departureStop === section.arrivalStop){
                break;
            }
            sections.push(section);

            if(i < journeyPointers.length-1){
                let nextDepartureStop = journeyPointers[i+1].enterTripAtStop;
                // raptor doesn't saves changes at stops. create them as footpath with a duration of 0 seconds.
                if(arrivalStop === nextDepartureStop && type === 'Train' && journeyPointers[i+1].footpath === null){
                    let stopName = GoogleTransitData.STOPS[nextDepartureStop].name;
                    let section: Section = {
                        departureTime: Converter.secondsToTime(arrivalTime),
                        arrivalTime: Converter.secondsToTime(arrivalTime),
                        departureStop: stopName,
                        arrivalStop: stopName,
                        duration: Converter.secondsToTime(CHANGE_TIME),
                        type: 'Footpath'
                    }
                    sections.push(section);
                }
            }
        }

        reliability = Math.floor(reliability * 100);

        // calculates departure and arrival date
        let departureDate = new Date(this.sourceDate);
        let arrivalDate = new Date(this.sourceDate);
        departureDate.setDate(this.sourceDate.getDate() + Converter.getDayDifference(journeyPointers[0].departureTime))
        arrivalDate.setDate(this.sourceDate.getDate() + Converter.getDayDifference(journeyPointers[journeyPointers.length-1].arrivalTime))
        let departureDateAsString = departureDate.toLocaleDateString('de-DE');
        let arrivalDateAsString = arrivalDate.toLocaleDateString('de-DE');

        // creates the journey response
        const journeyResponse: JourneyResponse = {
            sourceStop: sections[0].departureStop,
            targetStop: sections[sections.length-1].arrivalStop,
            departureTime: sections[0].departureTime,
            arrivalTime: sections[sections.length-1].arrivalTime,
            departureDate: departureDateAsString,
            arrivalDate: arrivalDateAsString,
            changes: Math.max(numberOfLegs - 1, 0),
            reliability: reliability.toString() + '%',
            sections: sections
        }
        return journeyResponse;
    }
}