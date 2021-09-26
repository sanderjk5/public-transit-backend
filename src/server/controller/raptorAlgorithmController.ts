import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { RouteStopMapping } from "../../models/RouteStopMapping";
import { StopTime } from "../../models/StopTime";
import { JourneyResponse } from "../../models/JourneyResponse";
import { Section } from "../../models/Section";
import express from "express";
import { performance } from 'perf_hooks';
import { Calculator } from "../../data/calculator";

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

// can be used to reconstruct the journey
interface JourneyPointer {
    enterTripAtStop: number,
    exitTripAtStop?: number,
    departureTime: number,
    arrivalTime: number,
    tripId: number,
    footpath: number,
}

export class RaptorAlgorithmController {
    // stores for each round k and each stop the earliest arrival time
    private static earliestArrivalTimePerRound: number[][];
    // stores for each stop the earliest arrival time independent from the round
    private static earliestArrivalTime: number[];
    // stores the marked stops of the current round
    private static markedStops: number[];
    // stores the route-stop pairs of the marked stops
    private static Q: QEntry[];
    // stores the journey pointer for each stop
    private static j: JourneyPointer[];

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
            const sourceStops = GoogleTransitData.getStopIdsByName(req.query.sourceStop);
            const targetStops = GoogleTransitData.getStopIdsByName(req.query.targetStop);
            // converts the source time
            const sourceTimeInSeconds = Converter.timeToSeconds(req.query.sourceTime)
            const sourceDate = new Date(req.query.date);
            this.sourceWeekday = Calculator.moduloSeven((sourceDate.getDay() - 1));
            // initializes the csa algorithm
            this.init(sourceStops, sourceTimeInSeconds);
            console.time('raptor algorithm')
            // calls the csa
            this.performAlgorithm(targetStops);
            console.timeEnd('raptor algorithm')
            // generates the http response which includes all information of the journey
            const journeyResponse = this.getJourneyResponse(sourceStops, targetStops, sourceDate);
            res.status(200).send(journeyResponse);
        } catch (err) {
            console.log(err);
            res.status(500).send(err);
        }
    }

    public static testAlgorithm(sourceStop: string, targetStop: string, sourceDate: Date, sourceTimeInSeconds: number){
        // gets the source and target stops
        const sourceStops = GoogleTransitData.getStopIdsByName(sourceStop);
        const targetStops = GoogleTransitData.getStopIdsByName(targetStop);
        // sets the source Weekday
        this.sourceWeekday = Calculator.moduloSeven((sourceDate.getDay() - 1));
        try {
            // initializes the csa algorithm
            this.init(sourceStops, sourceTimeInSeconds);
            const startTime = performance.now();
            // calls the csa
            this.performAlgorithm(targetStops);
            const duration = performance.now() - startTime;
            // gets the earliest arrival time at the target stops
            let earliestTargetStopArrival = this.earliestArrivalTime[targetStops[0]];
            for(let l = 1; l < targetStops.length; l++){
                if(this.earliestArrivalTime[targetStops[l]] < earliestTargetStopArrival){
                    earliestTargetStopArrival = this.earliestArrivalTime[targetStops[l]];
                }
            }
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
     * @param targetStops 
     */
    private static performAlgorithm(targetStops: number[]){
        let k = 0;
        while(true){
            k++;
            this.addNextArrivalTimeRound();

            let earliestTargetStopArrival = this.earliestArrivalTime[targetStops[0]];
            for(let l = 1; l < targetStops.length; l++){
                if(this.earliestArrivalTime[targetStops[l]] < earliestTargetStopArrival){
                    earliestTargetStopArrival = this.earliestArrivalTime[targetStops[l]];
                }
            }
            
            this.Q = [];
            let qTemp: QEntry[] = [];
            // stores the first stop of each round
            let routeSequenceMinima = new Array(GoogleTransitData.ROUTES.length);
            // loop over all marked stops
            while(this.markedStops.length > 0){
                let markedStop = this.markedStops.pop();
                // gets all routes which serves the current stop
                let routesServingStop: RouteStopMapping[] = GoogleTransitData.ROUTESSERVINGSTOPS[markedStop];
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

            // loop over all elements of q
            for(let i= 0; i < this.Q.length; i++){
                let r = this.Q[i].r;
                let p = this.Q[i].p;
                // get the earliest trip or r which can be catched at p in round k
                let tripInfo = this.getEarliestTrip(r, p, k);
                let t = tripInfo.tripId;
                let dayOffset = tripInfo.dayOffset;
                let enterTripAtStop = p;
                if(!t){
                    continue;
                }
                let reachedP = false;
                // loop over all stops of r beggining with p
                for(let j = 0; j < GoogleTransitData.STOPSOFAROUTE[r].length; j++){     
                    let pi = GoogleTransitData.STOPSOFAROUTE[r][j];
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
                    let arrivalTime = stopTime.arrivalTime + tripInfo.dayOffset;
                    let departureTime = stopTime.departureTime + tripInfo.dayOffset;
                    if(arrivalTime < tripInfo.tripDeparture){
                        arrivalTime += (24*3600);
                    }
                    if(departureTime < tripInfo.tripDeparture){
                        departureTime += (24*3600);
                    }

                    // gets the earliest arrival time at the target stops
                    let earliestTargetStopArrival = this.earliestArrivalTime[targetStops[0]];
                    for(let l = 1; l < targetStops.length; l++){
                        if(this.earliestArrivalTime[targetStops[l]] < earliestTargetStopArrival){
                            earliestTargetStopArrival = this.earliestArrivalTime[targetStops[l]];
                        }
                    }
                    // sets the arrival time + journey pointer
                    if(stopTime && arrivalTime < Math.min(this.earliestArrivalTime[pi], earliestTargetStopArrival)){
                        this.earliestArrivalTimePerRound[k][pi] = arrivalTime;
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
                    if(stopTime && this.earliestArrivalTimePerRound[k-1][pi] < departureTime){
                        let newT = this.getEarliestTrip(r, pi, k);
                        if(t !== newT.tripId || dayOffset !== newT.dayOffset){
                            tripInfo = newT;
                            t = tripInfo.tripId;
                            enterTripAtStop = stopTime.stopId;
                            dayOffset = tripInfo.dayOffset;
                        }
                    }
                }
            }
            
            // updates arrival times with footpaths of marked stops
            let numberOfMarkedStops = this.markedStops.length;
            let arrivalTimesInRoundK = [];
            for(let i = 0; i < numberOfMarkedStops; i++){
                let markedStop = this.markedStops[i];
                arrivalTimesInRoundK.push(this.earliestArrivalTimePerRound[k][markedStop])
            }

            for(let i = 0; i < numberOfMarkedStops; i++){
                let markedStop = this.markedStops[i];
                let arrivalTimeOfMarkedStop = arrivalTimesInRoundK[i];
                let footPaths = GoogleTransitData.getAllFootpathsOfAStop(markedStop);
                for(let j = 0; j < footPaths.length; j++){
                    let p = footPaths[j].departureStop;
                    let pN = footPaths[j].arrivalStop;
                    // checks if the footpath minimizes the arrival time in round k
                    if(p !== pN && this.earliestArrivalTimePerRound[k][pN] > (arrivalTimeOfMarkedStop + footPaths[j].duration)){
                        this.earliestArrivalTimePerRound[k][pN] = arrivalTimeOfMarkedStop + footPaths[j].duration;
                        if(!this.markedStops.includes(pN)){
                            this.markedStops.push(pN);
                        }
                        // checks if the new arrival time is smaller than the overall earliest arrival time
                        if(this.earliestArrivalTimePerRound[k][pN] < this.earliestArrivalTime[pN]){
                            this.earliestArrivalTime[pN] = this.earliestArrivalTimePerRound[k][pN];
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
        const firstRoundTimes = new Array(numberOfStops);
        this.earliestArrivalTimePerRound = [];
        this.earliestArrivalTime = new Array(numberOfStops);
        this.markedStops = [];
        this.j = new Array(numberOfStops);

        for(let i = 0; i < numberOfStops; i++) {
            firstRoundTimes[i] = Number.MAX_VALUE;
            this.earliestArrivalTime[i] = Number.MAX_VALUE;
        }

        // sets the source time of the source stops
        for(let i = 0; i < sourceStops.length; i++) {
            let sourceStop = sourceStops[i];
            firstRoundTimes[sourceStop] = sourceTime;
            this.earliestArrivalTime[sourceStop] = sourceTime;
            this.markedStops.push(sourceStop);
        }
        
        this.earliestArrivalTimePerRound.push(firstRoundTimes);

        // updates the footpaths of the source stops
        for(let i = 0; i < sourceStops.length; i++) {
            let sourceStop = sourceStops[i];
            let sourceFootpaths = GoogleTransitData.getAllFootpathsOfAStop(sourceStop);
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
     * Gets the earliest trip of route r which can be catched at stop pi in round k.
     * @param r 
     * @param pi 
     * @param k 
     * @returns 
     */
    private static getEarliestTrip(r: number, pi: number, k: number): EarliestTripInfo {
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

        let earliestArrival = this.earliestArrivalTimePerRound[k-1][pi];
        let earliestArrivalDayOffset = Converter.getDayOffset(earliestArrival);
        let previousDay = false;
        let currentWeekday = Calculator.moduloSeven(this.sourceWeekday + Converter.getDayDifference(earliestArrival));
        let previousWeekday = Calculator.moduloSeven(currentWeekday - 1);

        // loops over all stop times until it finds the first departure after the earliestArrival
        for(let i = 0; i < 7; i ++) {
            for(let j = 0; j < stopTimes.length; j++) {
                let stopTime = stopTimes[j];
                let departureTime = stopTime.departureTime;
                let serviceId = GoogleTransitData.TRIPS[stopTime.tripId].serviceId;
                if(GoogleTransitData.CALENDAR[serviceId].isAvailable[currentWeekday] && (departureTime + earliestArrivalDayOffset) >= earliestArrival 
                    && (departureTime + earliestArrivalDayOffset) < tripDeparture) {
                    tripId = stopTime.tripId;
                    tripDeparture = departureTime + earliestArrivalDayOffset;
                    previousDay = false;
                }
                let departureTimeOfPreviousDay = departureTime - (24*3600);
                if(GoogleTransitData.CALENDAR[serviceId].isAvailable[previousWeekday] && departureTimeOfPreviousDay >= 0 
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
            earliestArrivalDayOffset += (24*3600);
        }
        
        // checks if it found a trip at the same day
        if(tripId){
            let dayOffset: number;
            if(previousDay) {
                dayOffset = earliestArrivalDayOffset-(24*3600);
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

    /**
     * Uses the journey pointers to generate the journey response of the http request.
     * @param sourceStops 
     * @param targetStops 
     * @param initialDate 
     * @returns 
     */
    private static getJourneyResponse(sourceStops: number[], targetStops: number[], initialDate: Date): JourneyResponse {
        // finds the earliest arrival at the target stops
        let earliestTargetStopArrival = this.earliestArrivalTime[targetStops[0]];
        let earliestTargetStopId = targetStops[0];
        for(let i = 1; i < targetStops.length; i++){
            if(this.earliestArrivalTime[targetStops[i]] < earliestTargetStopArrival){
                earliestTargetStopArrival = this.earliestArrivalTime[targetStops[i]];
                earliestTargetStopId = targetStops[i];
            }
        }

        

        if(earliestTargetStopArrival === Number.MAX_VALUE){
            throw new Error("Couldn't find a connection.");
        }

        // reconstructs the journey pointers from target to source stop
        let journeyPointers: JourneyPointer[] = []
        let stopId = earliestTargetStopId;
        while(!sourceStops.includes(stopId)){
            this.j[stopId].exitTripAtStop = stopId;
            journeyPointers.push(this.j[stopId]);
            stopId = this.j[stopId].enterTripAtStop;
        }
        
        // generates the sections
        const sections: Section[] = []
        let numberOfFootpaths = 0;
        for(let i = (journeyPointers.length - 1); i >= 0; i--){
            let departureTime = journeyPointers[i].departureTime;
            let arrivalTime = journeyPointers[i].arrivalTime;
            let arrivalStop = journeyPointers[i].exitTripAtStop;
            let type = 'Train'
            if(journeyPointers[i].footpath !== null) {
                numberOfFootpaths++;
                type = 'Footpath'
            }
            let section: Section = {
                departureTime: Converter.secondsToTime(departureTime),
                arrivalTime: Converter.secondsToTime(arrivalTime),
                departureStop: GoogleTransitData.STOPS[journeyPointers[i].enterTripAtStop].name,
                arrivalStop: GoogleTransitData.STOPS[arrivalStop].name,
                duration: Converter.secondsToTime((arrivalTime - departureTime)),
                type: type
            }
            sections.push(section);
            if(i > 0){
                let nextDepartureStop = journeyPointers[i-1].enterTripAtStop;
                // raptor doesn't saves changes at stops. create them as footpath with a duration of 0 seconds.
                if(arrivalStop === nextDepartureStop && type === 'Train' && journeyPointers[i-1].footpath === null){
                    numberOfFootpaths++;
                    let stopName = GoogleTransitData.STOPS[nextDepartureStop].name;
                    let section: Section = {
                        departureTime: Converter.secondsToTime(arrivalTime),
                        arrivalTime: Converter.secondsToTime(arrivalTime),
                        departureStop: stopName,
                        arrivalStop: stopName,
                        duration: Converter.secondsToTime(0),
                        type: 'Footpath'
                    }
                    sections.push(section);
                }
            }
        }

        // calculates departure and arrival date
        let departureDate = new Date(initialDate);
        let arrivalDate = new Date(initialDate);
        departureDate.setDate(initialDate.getDate() + Converter.getDayDifference(journeyPointers[journeyPointers.length-1].departureTime))
        arrivalDate.setDate(initialDate.getDate() + Converter.getDayDifference(journeyPointers[0].arrivalTime))
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
            changes: sections.length - numberOfFootpaths - 1,
            sections: sections
        }
        return journeyResponse;
    }
}