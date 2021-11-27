import express from "express";
import { ALPHA, MAX_D_C_LONG, MAX_D_C_NORMAL, NUMBER_OF_DAYS, SECONDS_OF_A_DAY } from "../../constants";
import { Calculator } from "../../data/calculator";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Searcher } from "../../data/searcher";
import { Connection } from "../../models/Connection";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";
import { performance } from 'perf_hooks';
import { Reliability } from "../../data/reliability";
import FastPriorityQueue from 'fastpriorityqueue';
import { MeatResponse } from "../../models/MeatResponse";
import { TempEdge } from "../../models/TempEdge";
import { DecisionGraphController } from "./decisionGraphController";
import { cloneDeep } from "lodash";

// profile function entry
interface SEntry {
    departureTime: number,
    expectedArrivalTime: number,
    departureDate?: Date,
    arrivalDate?: Date,
    enterTime?: number,
    enterStop?: number,
    exitTime?: number,
    exitStop?: number,
    tripId?: number,
    transferFootpath?: number,
    finalFootpath?: number,
    calcReliability?: number,
}

// information for each trip
interface TEntry {
    expectedArrivalTime: number,
    arrivalDate?: Date,
    connectionArrivalTime?: number,
    connectionArrivalStop?: number,
    stopSequence?: number,
    finalFootpath?: number,
}

export class ConnectionScanMeatAlgorithmController {
    // the profile function of each stop
    private static s: SEntry[][];
    // the earliest expected arrival time of each trip
    private static t: TEntry[];
    // source stops
    private static sourceStop: number;
    // target stops
    private static targetStop: number;
    // minimum departure time of the journey
    private static minDepartureTime: number;
    // maximum arrival time of the journey
    private static maxArrivalTime: number;
    // relevant dates for the journey
    private static sourceDate: Date;
    private static meatDate: Date;
    private static currentDate: Date;

    private static dayOffset: number;

    // values which can be calculated by the normal csa algorithm
    private static earliestSafeArrivalTimeCSA: number;
    private static earliestArrivalTimes: number[];

    /**
     * Initializes and calls the algorithm to solve the minimum expected time problem.
     * @param req 
     * @param res 
     * @returns 
     */
    public static connectionScanMeatAlgorithmRoute(req: express.Request, res: express.Response){
        try {
            // checks the parameters of the http request
            if(!req.query || !req.query.sourceStop || !req.query.targetStop || !req.query.sourceTime || !req.query.date ||
                typeof req.query.sourceStop !== 'string' || typeof req.query.targetStop !== 'string' || typeof req.query.sourceTime !== 'string' || typeof req.query.date !== 'string'){
                res.status(400).send();
                return;
            }
            // gets the source and target stops
            this.sourceStop = GoogleTransitData.getStopIdByName(req.query.sourceStop);
            this.targetStop = GoogleTransitData.getStopIdByName(req.query.targetStop);
            // converts the minimum departure time and source date
            this.minDepartureTime = Converter.timeToSeconds(req.query.sourceTime);
            this.sourceDate = new Date(req.query.date);

            // initializes the csa meat algorithm
            this.init(ALPHA);
            // calls the csa meat algorithm
            console.time('connection scan meat algorithm')
            this.performAlgorithm();
            console.timeEnd('connection scan meat algorithm')
            // generates the http response which includes all information of the journey incl. the graphs
            const meatResponse = this.extractDecisionGraphs();
            res.send(meatResponse);
            this.clearArrays();
        } catch(error) {
            // console.log(error);
            console.timeEnd('connection scan algorithm')
            res.status(500).send(error);
            this.clearArrays();
        }
    }

    /**
     * Tests the connection scan meat algorithm.
     * @param sourceStop 
     * @param targetStop 
     * @param sourceTime 
     * @param sourceDate 
     * @returns 
     */
    public static testConnectionScanMeatAlgorithm(sourceStop: string, targetStop: string, sourceTime: string, sourceDate: Date, alpha: number){
        try {
            // gets the source and target stops
            this.sourceStop = GoogleTransitData.getStopIdByName(sourceStop);
            this.targetStop = GoogleTransitData.getStopIdByName(targetStop);
            // converts the source time
            this.minDepartureTime = Converter.timeToSeconds(sourceTime);
            this.sourceDate = sourceDate;

            const completeStartTime = performance.now();

            // initializes the csa meat algorithm
            const initStartTime = performance.now();
            this.init(alpha);
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
            let result = {
                expectedArrivalTime: this.s[this.sourceStop][0].expectedArrivalTime, 
                completeDuration: completeDuration,
                initDuration: initDuration, 
                algorithmDuration: algorithmDuration, 
                decisionGraphDuration: decisionGraphDuration,
                sArrary: this.s,
            }
            this.clearArrays();
            return result;
        } catch (error){
            this.clearArrays();
            return null;
        }
    }

    /**
     * Performs the CSA MEAT algorithm and returns the resulting S-Array.
     * @param sourceStop 
     * @param targetStop 
     * @param sourceTime 
     * @param sourceDate 
     * @returns 
     */
    public static getSArray(sourceStop: number, targetStop: number, sourceTime: number, sourceDate: Date, alpha: number){
        try {
            // gets the source and target stops
            this.sourceStop = sourceStop;
            this.targetStop = targetStop;
            // converts the source time
            this.minDepartureTime = sourceTime;
            this.sourceDate = sourceDate;

            // initializes the csa meat algorithm
            this.init(alpha);

            // calls the csa meat algorithm
            this.performAlgorithm();
            let sClone = cloneDeep(this.s);
            this.clearArrays();
            return sClone;
        } catch (error){
            this.clearArrays();
            return null;
        }
    }
  
    /**
     * Performs the modified version of the profile algorithm to solve the minimum expected arrival time problem.
     */
    private static performAlgorithm() {
        // sets the indices of the current and previous day (starts with maximum arrival time)
        let currentDayIndex = Searcher.binarySearchOfConnections(this.maxArrivalTime - this.dayOffset) - 1;
        let previousDayIndex = Searcher.binarySearchOfConnections(this.maxArrivalTime - this.dayOffset + SECONDS_OF_A_DAY) - 1;
        let lastDepartureTime = this.maxArrivalTime;
        let currentDayWeekday = Calculator.moduloSeven(this.currentDate.getDay() - 1);
        // evaluates connections until it reaches the minimum departure time
        while(lastDepartureTime >= this.minDepartureTime){
            // sets the connections
            const currentDayConnection = GoogleTransitData.CONNECTIONS[currentDayIndex];
            const previousDayConnection = GoogleTransitData.CONNECTIONS[previousDayIndex];
            let currentConnection: Connection;
            let currentConnectionDepartureTime: number;
            let currentConnectionArrivalTime: number;
            let currentWeekday: number;
            let currentArrivalDate = new Date(this.currentDate);
            let currentExpectedDelay: number;
            let currentMaxDelay: number;
            let currentConnectionIsLongDistanceTrip: boolean;
            // checks which connection is the next one
            if(currentDayConnection && currentDayConnection.departureTime >= Math.max(previousDayConnection.departureTime - SECONDS_OF_A_DAY, 0)){
                // sets the values of the current day connection
                currentConnection = currentDayConnection;
                currentConnectionDepartureTime = currentConnection.departureTime + this.dayOffset;
                currentConnectionArrivalTime = currentConnection.arrivalTime + this.dayOffset;
                // checks if the connection arrives at the next day
                if(currentConnection.arrivalTime >= SECONDS_OF_A_DAY){
                    currentArrivalDate.setDate(currentArrivalDate.getDate() + 1);
                }
                currentDayIndex--;
                currentWeekday = currentDayWeekday;
            } else if(previousDayConnection.departureTime >= SECONDS_OF_A_DAY) {
                // sets the values of the previous day connection
                currentConnection = previousDayConnection;
                currentConnectionDepartureTime = currentConnection.departureTime + this.dayOffset - SECONDS_OF_A_DAY;
                currentConnectionArrivalTime = currentConnection.arrivalTime + this.dayOffset - SECONDS_OF_A_DAY;
                previousDayIndex--;
                currentWeekday = Calculator.moduloSeven(currentDayWeekday - 1);
            } else {
                // shifts the previous and current day by one
                if(this.dayOffset === 0){
                    break;
                }
                currentDayIndex = previousDayIndex;
                previousDayIndex = GoogleTransitData.CONNECTIONS.length-1;
                this.dayOffset -= SECONDS_OF_A_DAY;
                currentDayWeekday = Calculator.moduloSeven(currentDayWeekday - 1);
                this.currentDate.setDate(this.currentDate.getDate() - 1);
                continue;
            }
            // sets the last departure time
            lastDepartureTime = currentConnectionDepartureTime;
            // checks if the connection is available on this weekday
            if(!GoogleTransitData.isAvailable(currentWeekday, GoogleTransitData.TRIPS[currentConnection.trip].isAvailable)){
                continue;
            }
            // checks if the connection arrives earlier than the maximum arrival time and can be reached from the source stop
            if(currentConnectionArrivalTime > this.maxArrivalTime || this.earliestArrivalTimes[currentConnection.departureStop] > currentConnectionDepartureTime) {
                continue;
            }
            // sets the delay values (depends on the type of the trip)
            if(GoogleTransitData.TRIPS[currentConnection.trip].isLongDistance){
                currentExpectedDelay = Reliability.longDistanceExpectedValue;
                currentMaxDelay = MAX_D_C_LONG;
                currentConnectionIsLongDistanceTrip = true;
            } else {
                currentExpectedDelay = Reliability.normalDistanceExpectedValue;
                currentMaxDelay = MAX_D_C_NORMAL;
                currentConnectionIsLongDistanceTrip = false;
            }
            // sets the three possible expected arrival times
            let time1: number;
            let time2: number;
            let time3: number;
            let timeC: number;
            let p: SEntry;
            // checks if the arrival stop of the connection is a target stop (expected arrival time when walking to the target)
            if(currentConnection.arrivalStop === this.targetStop) {
                time1 = currentConnectionArrivalTime + currentExpectedDelay;
            } else {
                time1 = Number.MAX_VALUE;
            }
            // expected arrival time when remaining seated
            let stopSequence = currentConnection.stopSequence;
            if(stopSequence < this.t[currentConnection.trip].stopSequence){
                time2 = this.t[currentConnection.trip].expectedArrivalTime;
            } else {
                time2 = Number.MAX_VALUE;
            }
            let expectedArrivalTime = 0;
            let pLastDepartureTime: number = -1;
            // finds all outgoing trips which have a departure time between c_arr and c_arr + maxD_c (and the departure after max delay)
            for(let j = 0; j < this.s[currentConnection.arrivalStop].length; j++) {
                p = this.s[currentConnection.arrivalStop][j];
                if(p.expectedArrivalTime === Number.MAX_VALUE){
                    expectedArrivalTime = Number.MAX_VALUE;
                    break;
                }
                if(p.departureTime >= currentConnectionArrivalTime && p.departureTime < currentConnectionArrivalTime + currentMaxDelay){
                    expectedArrivalTime += (p.expectedArrivalTime * Reliability.getReliability(pLastDepartureTime - currentConnectionArrivalTime, p.departureTime - currentConnectionArrivalTime, currentConnectionIsLongDistanceTrip));
                    pLastDepartureTime = p.departureTime;
                } else if(p.departureTime >= currentConnectionArrivalTime + currentMaxDelay) {
                    expectedArrivalTime += (p.expectedArrivalTime * Reliability.getReliability(pLastDepartureTime - currentConnectionArrivalTime, p.departureTime - currentConnectionArrivalTime, currentConnectionIsLongDistanceTrip));
                    break;
                }
            }
            if(expectedArrivalTime === 0){
                expectedArrivalTime = Number.MAX_VALUE;
            }
            // expected arrival time when transferring
            time3 = expectedArrivalTime;
            // finds the minimum expected arrival time
            timeC = Math.min(time1, time2, time3);

            // sets the pointer of the t array
            if(timeC !== Number.MAX_VALUE && timeC < this.t[currentConnection.trip].expectedArrivalTime){
                this.t[currentConnection.trip] = {
                    expectedArrivalTime: timeC,
                    arrivalDate: currentArrivalDate,
                    connectionArrivalTime: currentConnectionArrivalTime,
                    connectionArrivalStop: currentConnection.arrivalStop,
                    stopSequence: stopSequence,
                };
            }

            // sets the new profile function of the departure stop of the connection
            p = {
                departureTime: currentConnectionDepartureTime,
                expectedArrivalTime: timeC,
                departureDate: this.currentDate,
                arrivalDate: this.t[currentConnection.trip].arrivalDate,
                enterTime: currentConnectionDepartureTime,
                enterStop: currentConnection.departureStop,
                exitTime: this.t[currentConnection.trip].connectionArrivalTime,
                exitStop: this.t[currentConnection.trip].connectionArrivalStop,
                tripId: currentConnection.trip,
                finalFootpath: this.t[currentConnection.trip].finalFootpath,
            }

            // profile function with minimum expected arrival time of departure stop
            let q = this.s[currentConnection.departureStop][0];
            if(p.expectedArrivalTime !== Number.MAX_VALUE) {
                // checks if q dominates p
                if(!this.dominates(q, p)){
                    // adds p to the s entry of the departure stop
                    if(q.departureTime !== p.departureTime){
                        this.s[currentConnection.departureStop].unshift(p)
                    } else {
                        this.s[currentConnection.departureStop][0] = p;
                    }
                }
            }
        }
    }

    /**
     * Initializes the values of the algorithm.
     */
    private static init(alpha: number){
        this.earliestSafeArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(this.sourceStop, this.targetStop, this.sourceDate, this.minDepartureTime, true, this.minDepartureTime + (NUMBER_OF_DAYS * SECONDS_OF_A_DAY));
        if(this.earliestSafeArrivalTimeCSA === null) {
            throw new Error("Couldn't find a connection.")
        }

        // calculates the maximum arrival time of the alpha bounded version of the algorithm
        let difference = alpha * (this.earliestSafeArrivalTimeCSA - this.minDepartureTime);
        // this.maxArrivalTime = Math.min(this.minDepartureTime + difference, this.earliestSafeArrivalTimeCSA + SECONDS_OF_A_DAY - 1);
        this.maxArrivalTime = this.minDepartureTime + difference;
        this.earliestArrivalTimes = ConnectionScanAlgorithmController.getEarliestArrivalTimes(this.sourceStop, this.sourceDate, this.minDepartureTime, this.maxArrivalTime)
        
        // sets the relevant dates
        this.dayOffset = Converter.getDayOffset(this.maxArrivalTime);
        this.currentDate = new Date(this.sourceDate);

        this.currentDate.setDate(this.currentDate.getDate() + Converter.getDayDifference(this.maxArrivalTime));
        
        // sets the profile function array
        this.s = new Array(GoogleTransitData.STOPS.length);
        // sets the trip array
        this.t = new Array(GoogleTransitData.TRIPS.length);

        // default entry for each stop
        const defaultSEntry: SEntry = {
            departureTime: Number.MAX_VALUE,
            expectedArrivalTime: Number.MAX_VALUE,
        }
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++) {
            this.s[i] = [defaultSEntry];
        }
        // default entry for each trip
        for(let i = 0; i < this.t.length; i++) {
            this.t[i] = {
                expectedArrivalTime: Number.MAX_VALUE,
                stopSequence: Number.MAX_VALUE,
            };
        }
    }

    /**
     * Checks if q dominates p (domination means earlier expected arrival time or later departure time if the expected arrival times are the same).
     * @param q 
     * @param p 
     * @returns 
     */
    private static dominates(q: SEntry, p: SEntry): boolean {
        if(q.expectedArrivalTime < p.expectedArrivalTime) {
            return true;
        }
        if(q.expectedArrivalTime === p.expectedArrivalTime && q.departureTime > p.departureTime) {
            return true;
        }
        return false;
    }

    /**
     * Extracts the decision graph.
     * @returns 
     */
    private static extractDecisionGraphs() {
        if(this.s[this.sourceStop][0].expectedArrivalTime === Number.MAX_VALUE){
            throw new Error("Couldn't find a connection.")
        }
        // the minimum expected arrival time
        let meatTime = this.s[this.sourceStop][0].expectedArrivalTime;
        this.meatDate = new Date(this.sourceDate);
        this.meatDate.setDate(this.meatDate.getDate() + Converter.getDayDifference(meatTime));
        let departureDate = new Date(this.sourceDate);
        departureDate.setDate(this.sourceDate.getDate() + Converter.getDayDifference(this.s[this.sourceStop][0].departureTime));
        // sets the common values of the journey
        let meatResponse: MeatResponse = {
            sourceStop: GoogleTransitData.STOPS[this.sourceStop].name,
            targetStop: GoogleTransitData.STOPS[this.targetStop].name,
            departureTime: Converter.secondsToTime(this.s[this.sourceStop][0].departureTime),
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
        let priorityQueue = new FastPriorityQueue<SEntry>((a, b) => {
            return a.departureTime < b.departureTime
        });
        // adds the source stop
        let targetStopLabels: SEntry[] = [];
        this.s[this.sourceStop][0].calcReliability = 1;
        let stopDepartureCheck = new Map<number, number[]>();
        priorityQueue.add(this.s[this.sourceStop][0]);
        while(!priorityQueue.isEmpty()){
            let p = priorityQueue.poll();
            let tripId = p.tripId;
            // uses the information of the profile function to create an edge
            let edge: TempEdge = {
                departureStop: GoogleTransitData.STOPS[p.enterStop].name,
                departureTime: p.enterTime,
                arrivalStop: GoogleTransitData.STOPS[p.exitStop].name,
                arrivalTime: p.exitTime,
                type: 'Train',
            }
            expandedTempEdges.push(edge);
            if(arrivalTimesPerStop.get(edge.arrivalStop) === undefined) {
                arrivalTimesPerStop.set(edge.arrivalStop, [edge.arrivalTime]);
            } else {
                arrivalTimesPerStop.get(edge.arrivalStop).push(edge.arrivalTime);
            }
            // checks if the current profile reaches the target
            if(this.targetStop !== p.exitStop){
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
                let pLastDepartureTime = -1;
                // finds the next profile functions which can be added to the queue (every profile between departure and departure + max Delay and the first one after the max Delay).
                for(let i = 0; i < this.s[p.exitStop].length; i++) {
                    let nextP = this.s[p.exitStop][i];
                    if(nextP.departureTime >= p.exitTime && nextP.departureTime < (p.exitTime + maxDelay)){
                        let nextPCopy = cloneDeep(nextP)
                        let probabilityToTakeJourney = Reliability.getReliability(pLastDepartureTime - p.exitTime, nextP.departureTime - p.exitTime, isLongDistanceTrip);
                        nextPCopy.calcReliability = p.calcReliability * probabilityToTakeJourney;
                        let knownDepartureTimesOfNextStop = stopDepartureCheck.get(nextPCopy.enterStop);
                        if(knownDepartureTimesOfNextStop === undefined){
                            knownDepartureTimesOfNextStop = [];
                        }
                        if(!knownDepartureTimesOfNextStop.includes(nextPCopy.departureTime)){
                            knownDepartureTimesOfNextStop.push(nextPCopy.departureTime);
                            stopDepartureCheck.set(nextPCopy.enterStop, knownDepartureTimesOfNextStop)
                            priorityQueue.add(nextPCopy);
                        }
                        pLastDepartureTime = nextPCopy.departureTime;
                    }
                    if(nextP.departureTime >= (p.exitTime + maxDelay) && nextP.departureTime !== Number.MAX_VALUE){
                        let nextPCopy = cloneDeep(nextP)
                        let probabilityToTakeJourney = Reliability.getReliability(pLastDepartureTime - p.exitTime, nextP.departureTime - p.exitTime, isLongDistanceTrip);
                        nextPCopy.calcReliability = p.calcReliability * probabilityToTakeJourney;
                        let knownDepartureTimesOfNextStop = stopDepartureCheck.get(nextPCopy.enterStop);
                        if(knownDepartureTimesOfNextStop === undefined){
                            knownDepartureTimesOfNextStop = [];
                        }
                        if(!knownDepartureTimesOfNextStop.includes(nextPCopy.departureTime)){
                            knownDepartureTimesOfNextStop.push(nextPCopy.departureTime);
                            stopDepartureCheck.set(nextPCopy.enterStop, knownDepartureTimesOfNextStop)
                            priorityQueue.add(nextPCopy);
                        }
                        pLastDepartureTime = nextPCopy.departureTime;
                        break;
                    }
                }
            } 
            else {
                targetStopLabels.push(p)
            }
        }
        // let meat = this.calculateMEAT(targetStopLabels);
        // console.log(meat);
        // console.log(Converter.secondsToTime(meat));
        const decisionGraphs = DecisionGraphController.getDecisionGraphs(expandedTempEdges, arrivalTimesPerStop, this.sourceStop, this.targetStop);
        meatResponse.expandedDecisionGraph = decisionGraphs.expandedDecisionGraph;
        meatResponse.compactDecisionGraph = decisionGraphs.compactDecisionGraph;
        return meatResponse;
    }

    private static calculateMEAT(targetStopPairs: SEntry[]){
        let meat: number = 0;
        let probabilitySum = 0;
        for(let targetStopPair of targetStopPairs){
            let expectedDelay: number;
            if(GoogleTransitData.TRIPS[targetStopPair.tripId].isLongDistance){
                expectedDelay = Reliability.longDistanceExpectedValue;
            } else {
                expectedDelay = Reliability.normalDistanceExpectedValue;
            }
            probabilitySum += targetStopPair.calcReliability;
            let arrivalTime = targetStopPair.exitTime + expectedDelay;
            meat += (arrivalTime * targetStopPair.calcReliability);
        }
        console.log(probabilitySum)
        return meat;
    }

    private static clearArrays(){
        this.s = undefined;
        this.t = undefined;
        this.earliestArrivalTimes = undefined;
    }
}