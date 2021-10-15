import express from "express";
import { MAX_D_C_LONG, MAX_D_C_NORMAL, SECONDS_OF_A_DAY } from "../../constants";
import { Calculator } from "../../data/calculator";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Searcher } from "../../data/searcher";
import { Connection } from "../../models/Connection";
import { JourneyResponse } from "../../models/JourneyResponse";
import { Section } from "../../models/Section";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";
import { performance } from 'perf_hooks';
import { Reliability } from "../../data/reliability";
import FastPriorityQueue from 'fastpriorityqueue';
import { Link } from "../../models/Link";
import { DecisionGraph } from "../../models/DecisionGraph";
import {Node} from "../../models/Node";
import { Cluster } from "../../models/Cluster";
import { MeatResponse } from "../../models/MeatResponse";

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
}

// information for each trip
interface TEntry {
    expectedArrivalTime: number,
    arrivalDate?: Date,
    connectionArrivalTime?: number,
    connectionArrivalStop?: number,
    finalFootpath?: number,
}

// duration to the target stop
interface DEntry {
    duration: number,
    footpath: number,
}

// temporary edge to create the graph
interface TempEdge {
    departureStop: string,
    arrivalStop: string,
    departureTime: number,
    lastDepartureTime?: number
    arrivalTime?: number,
    type: string,
}

// temporary node to create the graph
interface TempNode {
    id: string,
    stop: string,
    time: number,
    type: string,
}

export class ProfileConnectionScanAlgorithmController {
    // the profile function of each stop
    private static s: SEntry[][];
    // the earliest expected arrival time of each trip
    private static t: TEntry[];
    // the duration of the shortest footpath to the target
    private static d: DEntry[];
    // source stops
    private static sourceStops: number[];
    // target stops
    private static targetStops: number[];
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
    private static earliestArrivalTimeCSA: number;
    private static earliestSafeArrivalTimeCSA: number;
    private static earliestArrivalTimes: number[];

    /**
     * Initializes and calls the algorithm to solve the minimum expected time problem.
     * @param req 
     * @param res 
     * @returns 
     */
    public static profileConnectionScanAlgorithmRoute(req: express.Request, res: express.Response){
        try {
            // checks the parameters of the http request
            if(!req.query || !req.query.sourceStop || !req.query.targetStop || !req.query.sourceTime || !req.query.date ||
                typeof req.query.sourceStop !== 'string' || typeof req.query.targetStop !== 'string' || typeof req.query.sourceTime !== 'string' || typeof req.query.date !== 'string'){
                res.status(400).send();
                return;
            }
            // gets the source and target stops
            this.sourceStops = GoogleTransitData.getStopIdsByName(req.query.sourceStop);
            this.targetStops = GoogleTransitData.getStopIdsByName(req.query.targetStop);
            // converts the minimum departure time and source date
            this.minDepartureTime = Converter.timeToSeconds(req.query.sourceTime);
            this.sourceDate = new Date(req.query.date);

            // gets the minimum times from the normal csa algorithm
            this.earliestArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, false);
            this.earliestSafeArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, true);
            if(this.earliestSafeArrivalTimeCSA === null || this.earliestArrivalTimeCSA === null) {
                throw new Error("Couldn't find a connection.")
            }

            // calculates the maximum arrival time of the alpha bounded version of the algorithm
            this.maxArrivalTime = this.earliestSafeArrivalTimeCSA + 1 * (this.earliestSafeArrivalTimeCSA - this.minDepartureTime);
            
            // sets the relevant dates
            this.dayOffset = Converter.getDayOffset(this.maxArrivalTime);
            this.currentDate = new Date(this.sourceDate);
            this.currentDate.setDate(this.currentDate.getDate() + Converter.getDayDifference(this.maxArrivalTime));
            
            this.earliestArrivalTimes = ConnectionScanAlgorithmController.getEarliestArrivalTimes(req.query.sourceStop, this.currentDate, this.minDepartureTime, this.maxArrivalTime)
            // initializes the csa algorithm
            this.init();
            // calls the csa
            console.time('connection scan profile algorithm')
            this.performAlgorithm();
            console.timeEnd('connection scan profile algorithm')
            
            // generates the http response which includes all information of the graph
            const meatResponse = this.extractDecisionGraphs();
            res.send(meatResponse);
        } catch(error) {
            console.log(error);
            console.timeEnd('connection scan algorithm')
            res.status(500).send(error);
        }
    }

    // public static testProfileConnectionScanAlgorithm(sourceStop: string, targetStop: string, sourceTime: string, sourceDate: Date){
    //     this.sourceStops = GoogleTransitData.getStopIdsByName(sourceStop);
    //     this.targetStops = GoogleTransitData.getStopIdsByName(targetStop);
    //     // converts the source time
    //     this.minDepartureTime = Converter.timeToSeconds(sourceTime);
    //     this.currentDate = sourceDate;

    //     try {
    //         this.earliestArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(sourceStop, targetStop, this.currentDate, this.minDepartureTime, false);
    //         if(this.earliestArrivalTimeCSA === null) {
    //             return {sameResult: true}
    //         }
    //     } catch (err) {
    //         return {sameResult: true}
    //     }
        
    //     this.maxArrivalTime = this.earliestArrivalTimeCSA + 1 * (this.earliestArrivalTimeCSA - this.minDepartureTime);
        
    //     this.dayOffset = Converter.getDayOffset(this.maxArrivalTime);
    //     this.currentDate.setDate(this.currentDate.getDate() + Converter.getDayDifference(this.maxArrivalTime));
    //     // initializes the csa algorithm
    //     this.init();
    //     // calls the csa
    //     const startTime = performance.now();
    //     this.performAlgorithm();
    //     const duration = performance.now() - startTime;
    //     // generates the http response which includes all information of the journey
    //     const earliestArrivalTimeProfile = this.getEarliestArrivalTime();
    //     if(this.earliestSafeArrivalTimeCSA === earliestArrivalTimeProfile){
    //         return {sameResult: true, duration: duration}
    //     } else {
    //         return {sameResult: false}
    //     }
    // }

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
            let serviceId = GoogleTransitData.TRIPS[currentConnection.trip].serviceId;
            if(!GoogleTransitData.CALENDAR[serviceId].isAvailable[currentWeekday]){
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
            // expected arrival time when walking to the target
            if(this.d[currentConnection.arrivalStop].duration !== Number.MAX_VALUE) {
                time1 = currentConnectionArrivalTime + currentExpectedDelay + this.d[currentConnection.arrivalStop].duration;
            } else {
                time1 = Number.MAX_VALUE;
            }
            // checks if the arrival stop of the connection is a target stop (expected arrival time when walking to the target)
            // if(currentConnection.arrivalStop === this.targetStops[0]) {
            //     time1 = currentConnectionArrivalTime + currentExpectedDelay;
            // } else {
            //     time1 = Number.MAX_VALUE;
            // }
            // expected arrival time when remaining seated
            time2 = this.t[currentConnection.trip].expectedArrivalTime;
            let expectedArrivalTime = Number.MAX_VALUE;
            let pLastDepartureTime: number;
            let relevantPairs: SEntry[] = [];
            // finds all outgoing trips which have a departure time between c_arr and c_arr + maxD_c (and the departure after max delay)
            for(let j = 0; j < this.s[currentConnection.arrivalStop].length; j++) {
                p = this.s[currentConnection.arrivalStop][j];
                if(p.departureTime >= currentConnectionArrivalTime && p.departureTime <= currentConnectionArrivalTime + currentMaxDelay){
                    relevantPairs.push(p);
                } else if(p.departureTime > currentConnectionArrivalTime + currentMaxDelay) {
                    relevantPairs.push(p);
                    break;
                }
            }
            // calculates the expected arrival time when transfering at the arrival stop of the current connection
            if(relevantPairs.length > 0){
                p = relevantPairs[0];
                expectedArrivalTime = p.expectedArrivalTime * Reliability.getReliability(-1, p.departureTime - currentConnectionArrivalTime, currentConnectionIsLongDistanceTrip);
                pLastDepartureTime = p.departureTime;
            }
            for(let j = 1; j < relevantPairs.length; j++) {
                p = relevantPairs[j];
                expectedArrivalTime += (p.expectedArrivalTime * Reliability.getReliability(pLastDepartureTime - currentConnectionArrivalTime, p.departureTime - currentConnectionArrivalTime, currentConnectionIsLongDistanceTrip));
                pLastDepartureTime = p.departureTime;
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
                };
                if(time1 === timeC && currentConnection.arrivalStop !== this.targetStops[0]){
                    this.t[currentConnection.trip].finalFootpath = this.d[currentConnection.arrivalStop].footpath;
                }
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
            // let q = this.s[currentConnection.departureStop][0];
            if(GoogleTransitData.STOPS[currentConnection.arrivalStop].name === 'Karlsruhe-Knielingen' && currentConnection.departureStop === this.sourceStops[0] && time1 === timeC){
                console.log('without footpath')
                console.log(p)
            }
            if(p.expectedArrivalTime !== Number.MAX_VALUE) {
                // checks if q dominates p
                // if(!this.dominates(q, p)){
                //     // adds p to the s entry of the departure stop
                //     if(q.departureTime !== p.departureTime){
                //         this.s[currentConnection.departureStop].unshift(p)
                //     } else {
                //         this.s[currentConnection.departureStop][0] = p;
                //     }
                // }
                let footpaths = GoogleTransitData.getAllFootpathsOfAArrivalStop(currentConnection.departureStop);
                for(let footpath of footpaths) {
                    let pNew: SEntry= {
                        departureTime: currentConnectionDepartureTime - footpath.duration,
                        expectedArrivalTime: p.expectedArrivalTime,
                        departureDate: p.departureDate,
                        arrivalDate: p.arrivalDate,
                        enterTime: p.enterTime,
                        enterStop: p.enterStop,
                        exitTime: p.exitTime,
                        exitStop: p.exitStop,
                        tripId: p.tripId,
                        transferFootpath: footpath.idArrival,
                        finalFootpath: p.finalFootpath,
                    }
                    if(pNew.departureTime < this.minDepartureTime){
                        continue;
                    }
                    if(this.notDominatedInProfile(pNew, footpath.departureStop)){
                        let shiftedPairs = [];
                        let currentPair = this.s[footpath.departureStop][0];
                        while(pNew.departureTime >= currentPair.departureTime){
                            let removedPair = this.s[footpath.departureStop].shift()
                            shiftedPairs.push(removedPair);
                            currentPair = this.s[footpath.departureStop][0];
                        }
                        this.s[footpath.departureStop].unshift(pNew);
                        for(let j = 0; j < shiftedPairs.length; j++) {
                            let removedPair = shiftedPairs[j];
                            if(!this.dominates(pNew, removedPair)){
                                this.s[footpath.departureStop].unshift(removedPair);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Initializes the values of the algorithm.
     */
    private static init(){
        // sets the profile function array
        this.s = new Array(GoogleTransitData.STOPS.length);
        // sets the trip array
        this.t = new Array(GoogleTransitData.TRIPS.length);
        this.d = new Array(GoogleTransitData.STOPS.length);

        // default entry for each stop
        const defaultSEntry: SEntry = {
            departureTime: Number.MAX_VALUE,
            expectedArrivalTime: Number.MAX_VALUE,
        }
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++) {
            this.s[i] = [defaultSEntry];
            this.d[i] = {
                duration: Number.MAX_VALUE,
                footpath: undefined,
            }
        }
        // default entry for each trip
        for(let i = 0; i < this.t.length; i++) {
            this.t[i] = {
                expectedArrivalTime: Number.MAX_VALUE
            };
        }
        for(let targetStop of this.targetStops){
            let finalFootpaths = GoogleTransitData.getAllFootpathsOfAArrivalStop(targetStop);
            for(let footpath of finalFootpaths){
                if(this.d[footpath.departureStop].duration > footpath.duration){
                    this.d[footpath.departureStop].duration = footpath.duration;
                    this.d[footpath.departureStop].footpath = footpath.idArrival;
                }
            }
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
        // the minimum expected arrival time
        let meatTime = this.s[this.sourceStops[0]][0].expectedArrivalTime;
        this.meatDate = new Date(this.sourceDate);
        this.meatDate.setDate(this.meatDate.getDate() + Converter.getDayDifference(meatTime));
        
        // sets the common values of the journey
        let meatResponse: MeatResponse = {
            sourceStop: GoogleTransitData.STOPS[this.sourceStops[0]].name,
            targetStop: GoogleTransitData.STOPS[this.targetStops[0]].name,
            departureTime: Converter.secondsToTime(this.s[this.sourceStops[0]][0].departureTime),
            departureDate: this.currentDate.toLocaleDateString('de-DE'),
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
        let expandedTempEdges: TempEdge[] = [];
        let arrivalTimesPerStop: Map<string, number[]> = new Map<string, number[]>();
        // priority queue sorted by the departure times
        let priorityQueue = new FastPriorityQueue<SEntry>((a, b) => {
            return a.departureTime > b.departureTime
        });
        if(this.s[this.sourceStops[0]][0].departureTime === Number.MAX_VALUE){
            throw new Error("Couldn't find a connection.")
        }
        // adds the source stop
        priorityQueue.add(this.s[this.sourceStops[0]][0]);
        while(!priorityQueue.isEmpty()){
            let p = priorityQueue.poll();
            let tripId = p.tripId;
            let transfer = GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath];
            if(transfer.departureStop !== transfer.arrivalStop){
                let transferEdge: TempEdge = {
                    departureStop: GoogleTransitData.STOPS[transfer.departureStop].name,
                    departureTime: p.departureTime,
                    arrivalStop: GoogleTransitData.STOPS[transfer.arrivalStop].name,
                    arrivalTime: p.departureTime + transfer.duration,
                    type: 'Footpath',
                }
                expandedTempEdges.push(transferEdge);
                if(arrivalTimesPerStop.get(transferEdge.arrivalStop) === undefined) {
                    arrivalTimesPerStop.set(transferEdge.arrivalStop, [transferEdge.arrivalTime]);
                } else {
                    arrivalTimesPerStop.get(transferEdge.arrivalStop).push(transferEdge.arrivalTime);
                }
            }
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
            if(p.finalFootpath !== undefined){
                let finalFootpath = GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.finalFootpath];
                if(finalFootpath.departureStop !== finalFootpath.arrivalStop){
                    let finalFootpathEdge: TempEdge = {
                        departureStop: GoogleTransitData.STOPS[finalFootpath.departureStop].name,
                        departureTime: p.exitTime,
                        arrivalStop: GoogleTransitData.STOPS[finalFootpath.arrivalStop].name,
                        arrivalTime: p.exitTime + finalFootpath.duration,
                        type: 'Footpath',
                    }
                    expandedTempEdges.push(finalFootpathEdge);
                    if(arrivalTimesPerStop.get(finalFootpathEdge.arrivalStop) === undefined) {
                        arrivalTimesPerStop.set(finalFootpathEdge.arrivalStop, [finalFootpathEdge.arrivalTime]);
                    } else {
                        arrivalTimesPerStop.get(finalFootpathEdge.arrivalStop).push(finalFootpathEdge.arrivalTime);
                    }
                    continue;
                }
            }
            // checks if the current profile reaches the target
            if(p.exitStop !== this.targetStops[0]){
                // sets max delay
                let maxDelay: number;
                if(GoogleTransitData.TRIPS[tripId].isLongDistance){
                    maxDelay = MAX_D_C_LONG;
                } else {
                    maxDelay = MAX_D_C_NORMAL;
                }
                // finds the next profile functions which can be added to the queue (every profile between departure and departure + max Delay and the first one after the max Delay).
                let relevantPs: SEntry[] = [];
                for(let i = 0; i < this.s[p.exitStop].length; i++) {
                    let nextP = this.s[p.exitStop][i];
                    if(nextP.departureTime >= p.exitTime && nextP.departureTime <= (p.exitTime + maxDelay)){
                        relevantPs.push(nextP);
                    }
                    if(nextP.departureTime > (p.exitTime + maxDelay) && nextP.departureTime !== Number.MAX_VALUE){
                        relevantPs.push(nextP);
                        break;
                    }
                }
                for (let nextP of relevantPs) {
                    priorityQueue.add(nextP);
                }
            }
        }
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

    private static notDominatedInProfile(p: SEntry, stopId: number): boolean{
        for(let q of this.s[stopId]){
            if(this.dominates(q, p)){
                return false;
            }
        }
        return true;
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
        lastArrivalTimes.push(Number.MAX_VALUE);
        lastArrivalTimes.sort((a, b) => a-b);
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