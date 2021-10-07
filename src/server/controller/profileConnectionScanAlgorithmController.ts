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

interface SEntry {
    departureTime: number,
    expectedArrivalTime: number,
    departureDate?: Date,
    arrivalDate?: Date,
    enterTime?: number,
    enterStop?: number,
    exitTime?: number,
    exitStop?: number,
    transferFootpath?: number,
}

interface TEntry {
    expectedArrivalTime: number,
    arrivalDate?: Date,
    connectionArrivalTime?: number,
    connectionArrivalStop?: number,
}

interface DGLeg {
    enterConnection: Connection,
    exitConnection: Connection,
}

export class ProfileConnectionScanAlgorithmController {
    private static s: SEntry[][];
    private static t: TEntry[];
    private static d: number[];
    private static sourceStops: number[];
    private static targetStops: number[];
    private static minDepartureTime: number;
    private static maxArrivalTime: number;
    private static currentDate: Date;

    private static dayOffset: number;
    private static earliestArrivalTimeCSA: number;

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

            this.earliestArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestSafeArrivalTime(req.query.sourceStop, req.query.targetStop, this.currentDate, this.minDepartureTime);
            if(this.earliestArrivalTimeCSA === null) {
                throw new Error("Couldn't find a connection.")
            }

            this.maxArrivalTime = this.earliestArrivalTimeCSA + 1 * (this.earliestArrivalTimeCSA - this.minDepartureTime);
            
            this.earliestArrivalTimes = ConnectionScanAlgorithmController.getEarliestArrivalTimes(req.query.sourceStop, this.currentDate, this.minDepartureTime, this.maxArrivalTime)
            this.dayOffset = Converter.getDayOffset(this.maxArrivalTime);
            this.currentDate.setDate(this.currentDate.getDate() + Converter.getDayDifference(this.maxArrivalTime));
            // initializes the csa algorithm
            this.init();
            // calls the csa
            console.time('connection scan profile algorithm')
            this.performAlgorithm();
            console.timeEnd('connection scan profile algorithm')
            // generates the http response which includes all information of the journey
            const journeyResponse = this.getJourney();
            res.send(journeyResponse);
        } catch(error) {
            console.timeEnd('connection scan algorithm')
            res.status(500).send(error);
        }
    }

    public static testProfileConnectionScanAlgorithm(sourceStop: string, targetStop: string, sourceTime: string, sourceDate: Date){
        this.sourceStops = GoogleTransitData.getStopIdsByName(sourceStop);
        this.targetStops = GoogleTransitData.getStopIdsByName(targetStop);
        // converts the source time
        this.minDepartureTime = Converter.timeToSeconds(sourceTime);
        this.currentDate = sourceDate;

        try {
            this.earliestArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestSafeArrivalTime(sourceStop, targetStop, this.currentDate, this.minDepartureTime);
            if(this.earliestArrivalTimeCSA === null) {
                return {sameResult: true}
            }
        } catch (err) {
            return {sameResult: true}
        }
        
        this.maxArrivalTime = this.earliestArrivalTimeCSA + 1 * (this.earliestArrivalTimeCSA - this.minDepartureTime);
        
        this.dayOffset = Converter.getDayOffset(this.maxArrivalTime);
        this.currentDate.setDate(this.currentDate.getDate() + Converter.getDayDifference(this.maxArrivalTime));
        // initializes the csa algorithm
        this.init();
        // calls the csa
        const startTime = performance.now();
        this.performAlgorithm();
        const duration = performance.now() - startTime;
        // generates the http response which includes all information of the journey
        const earliestArrivalTimeProfile = this.getEarliestArrivalTime();
        if(this.earliestArrivalTimeCSA === earliestArrivalTimeProfile){
            return {sameResult: true, duration: duration}
        } else {
            return {sameResult: false}
        }
    }

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
            if(currentConnectionArrivalTime > this.earliestArrivalTimeCSA || this.earliestArrivalTimes[currentConnection.departureStop] > currentConnectionDepartureTime) {
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
            if(this.d[currentConnection.arrivalStop] !== Number.MAX_VALUE) {
                time1 = currentConnectionArrivalTime + currentExpectedDelay + this.d[currentConnection.arrivalStop];
            } else {
                time1 = Number.MAX_VALUE;
            }
            time2 = this.t[currentConnection.trip].expectedArrivalTime;

            let expectedArrivalTime = Number.MAX_VALUE;
            let pLastDepartureTime: number;
            let relevantPairs: SEntry[];
            for(let j = 0; j < this.s[currentConnection.arrivalStop].length-1; j++) {
                p = this.s[currentConnection.arrivalStop][j];
                if(p.departureTime >= currentConnectionArrivalTime && p.departureTime <= currentConnectionArrivalTime + currentMaxDelay){
                    relevantPairs.push(p);
                } else if(p.departureTime > currentConnectionArrivalTime + currentMaxDelay) {
                    relevantPairs.push(p);
                    break;
                }
            }
            if(relevantPairs.length > 0){
                p = relevantPairs[0];
                expectedArrivalTime = p.expectedArrivalTime * Reliability.getReliability(0, p.departureTime - currentConnectionArrivalTime, currentConnectionIsLongDistanceTrip);
                pLastDepartureTime = p.departureTime;
            }
            for(let j = 1; j < relevantPairs.length; j++) {
                p = relevantPairs[j];
                expectedArrivalTime += p.expectedArrivalTime * Reliability.getReliability(pLastDepartureTime - currentConnectionArrivalTime, p.departureTime - currentConnectionArrivalTime, currentConnectionIsLongDistanceTrip);
                pLastDepartureTime = p.departureTime;
            }
            time3 = expectedArrivalTime;

            timeC = Math.min(time1, time2, time3);

            if(timeC < this.earliestArrivalTimeCSA){
                continue;
            }

            if(timeC !== Number.MAX_VALUE && timeC < this.t[currentConnection.trip].expectedArrivalTime){
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
            }
            
            if(p.exitStop !== undefined && p.expectedArrivalTime !== Number.MAX_VALUE) {
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
                        transferFootpath: footpath.idArrival,
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

    private static init(){
        this.s = new Array(GoogleTransitData.STOPS.length);
        this.t = new Array(GoogleTransitData.TRIPS.length);
        this.d = new Array(GoogleTransitData.STOPS.length);

        const defaultSEntry: SEntry = {
            departureTime: Number.MAX_VALUE,
            expectedArrivalTime: Number.MAX_VALUE,
        }
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++) {
            this.s[i] = [defaultSEntry];
            this.d[i] = Number.MAX_VALUE;
        }
        for(let i = 0; i < this.t.length; i++) {
            this.t[i] = {
                expectedArrivalTime: Number.MAX_VALUE
            };
        }
        for(let targetStop of this.targetStops){
            let finalFootpaths = GoogleTransitData.getAllFootpathsOfAArrivalStop(targetStop);
            for(let footpath of finalFootpaths){
                if(this.d[footpath.departureStop] > footpath.duration){
                    this.d[footpath.departureStop] = footpath.duration;
                }
            }
        }
        
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

    private static notDominatedInProfile(p: SEntry, stopId: number): boolean{
        for(let q of this.s[stopId]){
            if(this.dominates(q, p)){
                return false;
            }
        }
        return true;
    }

    private static getJourney(): JourneyResponse {
        const sections: Section[] = [];
        let s = this.sourceStops[0];
        let earliestArrivalTime = this.s[s][0].expectedArrivalTime;
        for(let stopId of this.sourceStops){
            if(this.s[stopId][0].expectedArrivalTime < earliestArrivalTime){
                s = stopId;
            }
        }
        let timeS = this.minDepartureTime;
        let foundFinalFootpath = false;
        let trainSectionCounter = 0;
        let departureDate: Date;
        let arrivalDate: Date;
        while(!this.targetStops.includes(s)){
            for(let i = 0; i < this.s[s].length; i++) {
                let p = this.s[s][i];
                if(p.departureTime >= timeS){
                    if(this.d[s] + timeS <= p.expectedArrivalTime){
                        const finalFootpathSection: Section = {
                            departureTime: Converter.secondsToTime(timeS),
                            arrivalTime: Converter.secondsToTime(timeS + this.d[s]),
                            duration: Converter.secondsToTime(this.d[s]),
                            departureStop: GoogleTransitData.STOPS[s].name,
                            arrivalStop: GoogleTransitData.STOPS[this.targetStops[0]].name,
                            type: 'Footpath',
                        }
                        sections.push(finalFootpathSection);
                        foundFinalFootpath = true;
                        if(this.sourceStops.includes(s)){
                            departureDate = this.currentDate;
                        }
                        if(p.arrivalDate){
                            arrivalDate = p.arrivalDate;
                        } else {
                            arrivalDate = this.currentDate;
                        }
                        break;
                    }
                    if(!this.sourceStops.includes(GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].departureStop) || !this.sourceStops.includes(GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].arrivalStop)){
                        const footpathSection: Section = {
                            departureTime: Converter.secondsToTime(timeS),
                            arrivalTime: Converter.secondsToTime(timeS + GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].duration),
                            duration: Converter.secondsToTime(GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].duration),
                            departureStop: GoogleTransitData.STOPS[GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].departureStop].name,
                            arrivalStop: GoogleTransitData.STOPS[GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].arrivalStop].name,
                            type: 'Footpath',
                        }
                        sections.push(footpathSection);
                    }
                    const trainSection: Section = {
                        departureTime: Converter.secondsToTime(p.enterTime),
                        arrivalTime: Converter.secondsToTime(p.exitTime),
                        duration: Converter.secondsToTime(p.exitTime - p.enterTime),
                        departureStop: GoogleTransitData.STOPS[p.enterStop].name,
                        arrivalStop: GoogleTransitData.STOPS[p.exitStop].name,
                        type: 'Train',
                    }
                    sections.push(trainSection);
                    trainSectionCounter++;
                    if(this.sourceStops.includes(s)){
                        departureDate = p.departureDate;
                    }
                    if(this.targetStops.includes(p.exitStop)) {
                        arrivalDate = p.arrivalDate;
                    }
                    s = p.exitStop;
                    timeS = p.exitTime;
                    break;
                }
            }
            if(foundFinalFootpath){
                break;
            }
        }
        const journeyResponse: JourneyResponse = {
            departureTime: sections[0].departureTime,
            arrivalTime: sections[sections.length-1].arrivalTime,
            departureDate: departureDate.toLocaleDateString('de-DE'),
            arrivalDate: arrivalDate.toLocaleDateString('de-DE'),
            changes: Math.max(0, trainSectionCounter - 1),
            sourceStop: GoogleTransitData.STOPS[this.sourceStops[0]].name,
            targetStop: GoogleTransitData.STOPS[this.targetStops[0]].name,
            sections: sections,
        }
        return journeyResponse;
    }

    private static getEarliestArrivalTime(): number {
        let s = this.sourceStops[0];
        let earliestArrivalTime = this.s[s][0].expectedArrivalTime;
        for(let stopId of this.sourceStops){
            if(this.s[stopId][0].expectedArrivalTime < earliestArrivalTime){
                s = stopId;
            }
        }
        let timeS = this.minDepartureTime;
        let foundFinalFootpath = false;
        while(!this.targetStops.includes(s)){
            for(let i = 0; i < this.s[s].length; i++) {
                let p = this.s[s][i];
                if(p.departureTime >= timeS){
                    if(this.d[s] + timeS <= p.expectedArrivalTime){
                        earliestArrivalTime = timeS + this.d[s];
                        foundFinalFootpath = true;
                        break;
                    }
                    earliestArrivalTime = p.exitTime;
                    s = p.exitStop;
                    timeS = p.exitTime;
                    break;
                }
            }
            if(foundFinalFootpath){
                break;
            }
        }
        return earliestArrivalTime;
    }

    private static extractDecisionGraph() {

    }
}