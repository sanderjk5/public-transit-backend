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
import { Edge } from "../../models/Edge";
import { DecisionGraph } from "../../models/DecisionGraph";
import {Node} from "../../models/Node";

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

interface TEntry {
    expectedArrivalTime: number,
    arrivalDate?: Date,
    connectionArrivalTime?: number,
    connectionArrivalStop?: number,
}

interface DEntry {
    duration: number,
    footpath: number,
}

export class ProfileConnectionScanAlgorithmController {
    private static s: SEntry[][];
    private static t: TEntry[];
    private static d: DEntry[];
    private static sourceStops: number[];
    private static targetStops: number[];
    private static minDepartureTime: number;
    private static maxArrivalTime: number;
    private static currentDate: Date;

    private static dayOffset: number;
    private static earliestArrivalTimeCSA: number;
    private static earliestSafeArrivalTimeCSA: number;

    private static earliestArrivalTimes: number[];

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
            // converts the source time
            this.minDepartureTime = Converter.timeToSeconds(req.query.sourceTime);
            this.currentDate = new Date(req.query.date);

            this.earliestArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.currentDate, this.minDepartureTime, false);
            this.earliestSafeArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.currentDate, this.minDepartureTime, true);
            if(this.earliestSafeArrivalTimeCSA === null || this.earliestArrivalTimeCSA === null) {
                throw new Error("Couldn't find a connection.")
            }

            this.maxArrivalTime = this.earliestSafeArrivalTimeCSA + 1 * (this.earliestSafeArrivalTimeCSA - this.minDepartureTime);
            
            this.earliestArrivalTimes = ConnectionScanAlgorithmController.getEarliestArrivalTimes(req.query.sourceStop, this.currentDate, this.minDepartureTime, this.maxArrivalTime)
            this.dayOffset = Converter.getDayOffset(this.maxArrivalTime);
            this.currentDate.setDate(this.currentDate.getDate() + Converter.getDayDifference(this.maxArrivalTime));
            // initializes the csa algorithm
            this.init();
            // calls the csa
            console.time('connection scan profile algorithm')
            this.performAlgorithm();
            console.timeEnd('connection scan profile algorithm')
            console.log(this.earliestArrivalTimeCSA + ', ' + Converter.secondsToTime(this.earliestArrivalTimeCSA))
            console.log(this.earliestSafeArrivalTimeCSA + ', ' + Converter.secondsToTime(this.earliestSafeArrivalTimeCSA))
            console.log(this.maxArrivalTime + ', ' + Converter.secondsToTime(this.maxArrivalTime))
            console.log(this.s[this.sourceStops[0]][0].expectedArrivalTime + ', ' + Converter.secondsToTime(this.s[this.sourceStops[0]][0].expectedArrivalTime))
            // generates the http response which includes all information of the journey
            const decisionGraph = this.extractDecisionGraph();
            console.log(decisionGraph);
            res.send();
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

    private static performAlgorithm() {
        let currentDayIndex = Searcher.binarySearchOfConnections(this.maxArrivalTime - this.dayOffset) - 1;
        let previousDayIndex = Searcher.binarySearchOfConnections(this.maxArrivalTime - this.dayOffset + SECONDS_OF_A_DAY) - 1;
        let lastDepartureTime = this.maxArrivalTime;
        let currentDayWeekday = Calculator.moduloSeven(this.currentDate.getDay() - 1);
        while(lastDepartureTime >= this.minDepartureTime){
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
            if(currentDayConnection && currentDayConnection.departureTime >= Math.max(previousDayConnection.departureTime - SECONDS_OF_A_DAY, 0)){
                currentConnection = currentDayConnection;
                currentConnectionDepartureTime = currentConnection.departureTime + this.dayOffset;
                currentConnectionArrivalTime = currentConnection.arrivalTime + this.dayOffset;
                if(currentConnection.arrivalTime >= SECONDS_OF_A_DAY){
                    currentArrivalDate.setDate(currentArrivalDate.getDate() + 1);
                }
                currentDayIndex--;
                currentWeekday = currentDayWeekday;
            } else if(previousDayConnection.departureTime >= SECONDS_OF_A_DAY) {
                currentConnection = previousDayConnection;
                currentConnectionDepartureTime = currentConnection.departureTime + this.dayOffset - SECONDS_OF_A_DAY;
                currentConnectionArrivalTime = currentConnection.arrivalTime + this.dayOffset - SECONDS_OF_A_DAY;
                previousDayIndex--;
                currentWeekday = Calculator.moduloSeven(currentDayWeekday - 1);
            } else {
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
            lastDepartureTime = currentConnectionDepartureTime;
            let serviceId = GoogleTransitData.TRIPS[currentConnection.trip].serviceId;
            if(!GoogleTransitData.CALENDAR[serviceId].isAvailable[currentWeekday]){
                continue;
            }
            if(currentConnectionArrivalTime > this.earliestSafeArrivalTimeCSA || this.earliestArrivalTimes[currentConnection.departureStop] > currentConnectionDepartureTime) {
                continue;
            }
            if(GoogleTransitData.TRIPS[currentConnection.trip].isLongDistance){
                currentExpectedDelay = Reliability.longDistanceExpectedValue;
                currentMaxDelay = MAX_D_C_LONG;
                currentConnectionIsLongDistanceTrip = true;
            } else {
                currentExpectedDelay = Reliability.normalDistanceExpectedValue;
                currentMaxDelay = MAX_D_C_NORMAL;
                currentConnectionIsLongDistanceTrip = false;
            }
            let time1: number;
            let time2: number;
            let time3: number;
            let timeC: number;
            let p: SEntry;
            // if(this.d[currentConnection.arrivalStop].duration !== Number.MAX_VALUE) {
            //     time1 = currentConnectionArrivalTime + currentExpectedDelay + this.d[currentConnection.arrivalStop].duration;
            // } else {
            //     time1 = Number.MAX_VALUE;
            // }
            if(currentConnection.arrivalStop === this.targetStops[0]) {
                time1 = currentConnectionArrivalTime + currentExpectedDelay;
            } else {
                time1 = Number.MAX_VALUE;
            }
            time2 = this.t[currentConnection.trip].expectedArrivalTime;
            let reliability = 0;
            let expectedArrivalTime = Number.MAX_VALUE;
            let pLastDepartureTime: number;
            let relevantPairs: SEntry[] = [];
            let foundSafeJourney = false;
            for(let j = 0; j < this.s[currentConnection.arrivalStop].length-1; j++) {
                p = this.s[currentConnection.arrivalStop][j];
                if(p.departureTime >= currentConnectionArrivalTime && p.departureTime <= currentConnectionArrivalTime + currentMaxDelay){
                    relevantPairs.push(p);
                    // foundSafeJourney = true;
                } else if(p.departureTime > currentConnectionArrivalTime + currentMaxDelay) {
                    foundSafeJourney = true;
                    relevantPairs.push(p);
                    break;
                }
            }
            if(foundSafeJourney){
                if(relevantPairs.length > 0){
                    p = relevantPairs[0];
                    reliability += Reliability.getReliability(0, p.departureTime - currentConnectionArrivalTime, currentConnectionIsLongDistanceTrip);
                    expectedArrivalTime = p.expectedArrivalTime * Reliability.getReliability(0, p.departureTime - currentConnectionArrivalTime, currentConnectionIsLongDistanceTrip);
                    pLastDepartureTime = p.departureTime;
                }
                for(let j = 1; j < relevantPairs.length; j++) {
                    p = relevantPairs[j];
                    reliability += Reliability.getReliability(0, p.departureTime - currentConnectionArrivalTime, currentConnectionIsLongDistanceTrip);
                    expectedArrivalTime += (p.expectedArrivalTime * Reliability.getReliability(pLastDepartureTime - currentConnectionArrivalTime, p.departureTime - currentConnectionArrivalTime, currentConnectionIsLongDistanceTrip));
                    pLastDepartureTime = p.departureTime;
                }
                console.log(reliability)
            }
            
            time3 = expectedArrivalTime;

            timeC = Math.min(time1, time2, time3);
            // if(timeC !== Number.MAX_VALUE){
            //     console.log(timeC + ', ' + time1 + ', ' + time2 + ', ' + time3)
            // }

            // if(timeC < this.earliestArrivalTimeCSA){
            //     continue;
            // }

            if(timeC !== Number.MAX_VALUE && timeC < this.t[currentConnection.trip].expectedArrivalTime){
                if(this.t[currentConnection.trip].expectedArrivalTime < 1){
                    continue;
                }
                this.t[currentConnection.trip] = {
                    expectedArrivalTime: timeC,
                    arrivalDate: currentArrivalDate,
                    connectionArrivalTime: currentConnectionArrivalTime,
                    connectionArrivalStop: currentConnection.arrivalStop,
                };
            }

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
            }

            // if(time1 === timeC && time1 !== Number.MAX_VALUE && currentConnection.arrivalStop !== this.targetStops[0]){
            //     p.finalFootpath = this.d[currentConnection.arrivalStop].footpath;
            // }

            let q = this.s[currentConnection.departureStop][0];
            
            if(p.expectedArrivalTime !== Number.MAX_VALUE) {
                if(!this.dominates(q, p)){
                    if(q.departureTime !== p.departureTime){
                        this.s[currentConnection.departureStop].unshift(p)
                    } else {
                        this.s[currentConnection.departureStop][0] = p;
                    }
                }
                // let footpaths = GoogleTransitData.getAllFootpathsOfAArrivalStop(currentConnection.departureStop);
                // for(let footpath of footpaths) {
                //     let pNew: SEntry= {
                //         departureTime: currentConnectionDepartureTime - footpath.duration,
                //         expectedArrivalTime: p.expectedArrivalTime,
                //         departureDate: p.departureDate,
                //         arrivalDate: p.arrivalDate,
                //         connectionDepartureTime: p.connectionDepartureTime,
                //         connectionDepartureStop: p.connectionDepartureStop,
                //         connectionArrivalTime: p.connectionArrivalTime,
                //         connectionArrivalStop: p.connectionArrivalStop,
                //         connectionId: p.connectionId,
                //         // transferFootpath: footpath.idArrival,
                //         // finalFootpath: p.finalFootpath,
                //     }
                //     if(pNew.departureTime < this.minDepartureTime){
                //         continue;
                //     }
                //     if(this.notDominatedInProfile(pNew, footpath.departureStop)){
                //         let shiftedPairs = [];
                //         let currentPair = this.s[footpath.departureStop][0];
                //         while(pNew.departureTime >= currentPair.departureTime){
                //             let removedPair = this.s[footpath.departureStop].shift()
                //             shiftedPairs.push(removedPair);
                //             currentPair = this.s[footpath.departureStop][0];
                //         }
                //         this.s[footpath.departureStop].unshift(pNew);
                //         for(let j = 0; j < shiftedPairs.length; j++) {
                //             let removedPair = shiftedPairs[j];
                //             if(!this.dominates(pNew, removedPair)){
                //                 this.s[footpath.departureStop].unshift(removedPair);
                //             }
                //         }
                //     }
                // }
            }
        }
    }

    private static init(){
        this.s = new Array(GoogleTransitData.STOPS.length);
        this.t = new Array(GoogleTransitData.TRIPS.length);
        // this.d = new Array(GoogleTransitData.STOPS.length);

        const defaultSEntry: SEntry = {
            departureTime: Number.MAX_VALUE,
            expectedArrivalTime: Number.MAX_VALUE,
        }
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++) {
            this.s[i] = [defaultSEntry];
            // this.d[i] = {
            //     duration: Number.MAX_VALUE,
            //     footpath: undefined,
            // }
        }
        for(let i = 0; i < this.t.length; i++) {
            this.t[i] = {
                expectedArrivalTime: Number.MAX_VALUE
            };
        }
        // for(let targetStop of this.targetStops){
        //     let finalFootpaths = GoogleTransitData.getAllFootpathsOfAArrivalStop(targetStop);
        //     for(let footpath of finalFootpaths){
        //         if(this.d[footpath.departureStop].duration > footpath.duration){
        //             this.d[footpath.departureStop].duration = footpath.duration;
        //             this.d[footpath.departureStop].footpath = footpath.idArrival;
        //         }
        //     }
        // }
        
    }

    private static dominates(q: SEntry, p: SEntry): boolean {
        if(q.expectedArrivalTime < p.expectedArrivalTime) {
            return true;
        }
        if(q.expectedArrivalTime === p.expectedArrivalTime && q.departureTime > p.departureTime) {
            return true;
        }
        return false;
    }

    private static extractDecisionGraph() {
        let decisionGraph: DecisionGraph = {
            nodes: [],
            edges: [],
        };     
        let priorityQueue = new FastPriorityQueue<SEntry>((a, b) => {
            return a.departureTime > b.departureTime
        });
        priorityQueue.add(this.s[this.sourceStops[0]][0]);
        console.log(this.s[this.sourceStops[0]])
        while(!priorityQueue.isEmpty()){
            let p = priorityQueue.poll();
            let tripId = p.tripId;
            let edge: Edge = {
                departureStop: GoogleTransitData.STOPS[p.enterStop].name,
                departureTime: Converter.secondsToTime(p.enterTime),
                arrivalStop: GoogleTransitData.STOPS[p.exitStop].name,
                arrivalTime: Converter.secondsToTime(p.exitTime),
                type: 'Train',
            }
            decisionGraph.edges.push(edge);
            if(p.exitStop !== this.targetStops[0]){
                let maxDelay: number;
                if(GoogleTransitData.TRIPS[tripId].isLongDistance){
                    maxDelay = MAX_D_C_LONG;
                } else {
                    maxDelay = MAX_D_C_NORMAL;
                }
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
        let nodes = [];
        for(let edge of decisionGraph.edges){
            if(!nodes.includes(edge.departureStop)){
                let node: Node = {
                    stop: edge.departureStop,
                }
                decisionGraph.nodes.push(node);
                nodes.push(edge.departureStop);
            }
            if(!nodes.includes(edge.arrivalStop)){
                let node: Node = {
                    stop: edge.arrivalStop,
                }
                decisionGraph.nodes.push(node);
                nodes.push(edge.arrivalStop);
            }
        }
        return decisionGraph;
    }

    private static notDominatedInProfile(p: SEntry, stopId: number): boolean{
        for(let q of this.s[stopId]){
            if(this.dominates(q, p)){
                return false;
            }
        }
        return true;
    }

    // private static getJourney(): JourneyResponse {
    //     const sections: Section[] = [];
    //     let s = this.sourceStops[0];
    //     let earliestArrivalTime = this.s[s][0].expectedArrivalTime;
    //     for(let stopId of this.sourceStops){
    //         if(this.s[stopId][0].expectedArrivalTime < earliestArrivalTime){
    //             s = stopId;
    //         }
    //     }
    //     let timeS = this.minDepartureTime;
    //     let foundFinalFootpath = false;
    //     let trainSectionCounter = 0;
    //     let departureDate: Date;
    //     let arrivalDate: Date;
    //     while(!this.targetStops.includes(s)){
    //         for(let i = 0; i < this.s[s].length; i++) {
    //             let p = this.s[s][i];
    //             if(p.departureTime >= timeS){
    //                 if(this.d[s].duration + timeS <= p.expectedArrivalTime){
    //                     const finalFootpathSection: Section = {
    //                         departureTime: Converter.secondsToTime(timeS),
    //                         arrivalTime: Converter.secondsToTime(timeS + this.d[s].duration),
    //                         duration: Converter.secondsToTime(this.d[s].duration),
    //                         departureStop: GoogleTransitData.STOPS[s].name,
    //                         arrivalStop: GoogleTransitData.STOPS[this.targetStops[0]].name,
    //                         type: 'Footpath',
    //                     }
    //                     sections.push(finalFootpathSection);
    //                     foundFinalFootpath = true;
    //                     if(this.sourceStops.includes(s)){
    //                         departureDate = this.currentDate;
    //                     }
    //                     if(p.arrivalDate){
    //                         arrivalDate = p.arrivalDate;
    //                     } else {
    //                         arrivalDate = this.currentDate;
    //                     }
    //                     break;
    //                 }
    //                 if(!this.sourceStops.includes(GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].departureStop) || !this.sourceStops.includes(GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].arrivalStop)){
    //                     const footpathSection: Section = {
    //                         departureTime: Converter.secondsToTime(timeS),
    //                         arrivalTime: Converter.secondsToTime(timeS + GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].duration),
    //                         duration: Converter.secondsToTime(GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].duration),
    //                         departureStop: GoogleTransitData.STOPS[GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].departureStop].name,
    //                         arrivalStop: GoogleTransitData.STOPS[GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].arrivalStop].name,
    //                         type: 'Footpath',
    //                     }
    //                     sections.push(footpathSection);
    //                 }
    //                 const trainSection: Section = {
    //                     departureTime: Converter.secondsToTime(p.connectionDepartureTime),
    //                     arrivalTime: Converter.secondsToTime(p.exitTime),
    //                     duration: Converter.secondsToTime(p.exitTime - p.connectionDepartureTime),
    //                     departureStop: GoogleTransitData.STOPS[p.connectionDepartureStop].name,
    //                     arrivalStop: GoogleTransitData.STOPS[p.exitStop].name,
    //                     type: 'Train',
    //                 }
    //                 sections.push(trainSection);
    //                 trainSectionCounter++;
    //                 if(this.sourceStops.includes(s)){
    //                     departureDate = p.departureDate;
    //                 }
    //                 if(this.targetStops.includes(p.exitStop)) {
    //                     arrivalDate = p.arrivalDate;
    //                 }
    //                 s = p.exitStop;
    //                 timeS = p.exitTime;
    //                 break;
    //             }
    //         }
    //         if(foundFinalFootpath){
    //             break;
    //         }
    //     }
    //     const journeyResponse: JourneyResponse = {
    //         departureTime: sections[0].departureTime,
    //         arrivalTime: sections[sections.length-1].arrivalTime,
    //         departureDate: departureDate.toLocaleDateString('de-DE'),
    //         arrivalDate: arrivalDate.toLocaleDateString('de-DE'),
    //         changes: Math.max(0, trainSectionCounter - 1),
    //         sourceStop: GoogleTransitData.STOPS[this.sourceStops[0]].name,
    //         targetStop: GoogleTransitData.STOPS[this.targetStops[0]].name,
    //         sections: sections,
    //     }
    //     return journeyResponse;
    // }

    // private static getEarliestArrivalTime(): number {
    //     let s = this.sourceStops[0];
    //     let earliestArrivalTime = this.s[s][0].expectedArrivalTime;
    //     for(let stopId of this.sourceStops){
    //         if(this.s[stopId][0].expectedArrivalTime < earliestArrivalTime){
    //             s = stopId;
    //         }
    //     }
    //     let timeS = this.minDepartureTime;
    //     let foundFinalFootpath = false;
    //     while(!this.targetStops.includes(s)){
    //         for(let i = 0; i < this.s[s].length; i++) {
    //             let p = this.s[s][i];
    //             if(p.departureTime >= timeS){
    //                 if(this.d[s].duration + timeS <= p.expectedArrivalTime){
    //                     earliestArrivalTime = timeS + this.d[s].duration;
    //                     foundFinalFootpath = true;
    //                     break;
    //                 }
    //                 earliestArrivalTime = p.exitTime;
    //                 s = p.exitStop;
    //                 timeS = p.exitTime;
    //                 break;
    //             }
    //         }
    //         if(foundFinalFootpath){
    //             break;
    //         }
    //     }
    //     return earliestArrivalTime;
    // }

    
}