import express from "express";
import { SECONDS_OF_A_DAY } from "../../constants";
import { Calculator } from "../../data/calculator";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Searcher } from "../../data/searcher";
import { Connection } from "../../models/Connection";
import { JourneyResponse } from "../../models/JourneyResponse";
import { Section } from "../../models/Section";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";
import { performance } from 'perf_hooks';

// profile function entry
interface SEntry {
    departureTime: number,
    arrivalTime: number,
    departureDate?: Date,
    arrivalDate?: Date,
    enterTime?: number,
    enterStop?: number,
    exitTime?: number,
    exitStop?: number,
    transferFootpath?: number,
}

// information for each trip
interface TEntry {
    arrivalTime: number,
    arrivalDate?: Date,
    connectionArrivalTime?: number,
    connectionArrivalStop?: number,
}

export class ProfileConnectionScanAlgorithmController {
    // the profile function of each stop
    private static s: SEntry[][];
    // the earliest expected arrival time of each trip
    private static t: TEntry[];
    // the duration of the shortest footpath to the target
    private static d: number[];
    // source stops
    private static sourceStops: number[];
    // target stops
    private static targetStops: number[];
    // minimum departure time of the journey
    private static minDepartureTime: number;
    // maximum arrival time of the journey
    private static maxArrivalTime: number;
    // current date of the algorithm
    private static currentDate: Date;

    private static dayOffset: number;

    // earliest arrival time which can be calculated by the normal csa algorithm
    private static earliestArrivalTimeCSA: number;

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
            // converts the minimal departure time and date
            this.minDepartureTime = Converter.timeToSeconds(req.query.sourceTime);
            this.currentDate = new Date(req.query.date);

            // gets the earliest arrival time by the normal csa
            this.earliestArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.currentDate, this.minDepartureTime);
            if(this.earliestArrivalTimeCSA === null) {
                throw new Error("Couldn't find a connection.")
            }

            // sets the maximum arrival time
            this.maxArrivalTime = this.earliestArrivalTimeCSA + 0.5 * (this.earliestArrivalTimeCSA - this.minDepartureTime);
            
            this.dayOffset = Converter.getDayOffset(this.maxArrivalTime);

            // sets the current date
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
            this.earliestArrivalTimeCSA = ConnectionScanAlgorithmController.getEarliestArrivalTime(sourceStop, targetStop, this.currentDate, this.minDepartureTime);
            if(this.earliestArrivalTimeCSA === null) {
                return {sameResult: true}
            }
        } catch (err) {
            return {sameResult: true}
        }
        
        this.maxArrivalTime = this.earliestArrivalTimeCSA + 0.5 * (this.earliestArrivalTimeCSA - this.minDepartureTime);
        
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
            // sets the three possible arrival times
            let time1: number;
            let time2: number;
            let time3: number;
            let timeC: number;
            let p: SEntry;
            // arrival time when walking to the target
            if(this.d[currentConnection.arrivalStop] !== Number.MAX_VALUE) {
                time1 = currentConnectionArrivalTime + this.d[currentConnection.arrivalStop];
            } else {
                time1 = Number.MAX_VALUE;
            }
            // arrival time when remaining seated
            time2 = this.t[currentConnection.trip].arrivalTime;
            // finds the first outgoing trip which can be reached
            let j = 0;
            p = this.s[currentConnection.arrivalStop][j];
            while(p.departureTime < currentConnectionArrivalTime) {
                j++;
                p = this.s[currentConnection.arrivalStop][j];
            }
            // arrival time when transferring
            time3 = p.arrivalTime;

            // finds the minimum expected arrival time
            timeC = Math.min(time1, time2, time3);
            if(timeC < this.earliestArrivalTimeCSA){
                continue;
            }

            // sets the pointer of the t array
            if(timeC !== Number.MAX_VALUE && timeC < this.t[currentConnection.trip].arrivalTime){
                this.t[currentConnection.trip] = {
                    arrivalTime: timeC,
                    arrivalDate: currentArrivalDate,
                    connectionArrivalTime: currentConnectionArrivalTime,
                    connectionArrivalStop: currentConnection.arrivalStop,
                };
            }

            // sets the new profile function of the departure stop of the connection
            p = {
                departureTime: currentConnectionDepartureTime,
                arrivalTime: timeC,
                departureDate: this.currentDate,
                arrivalDate: this.t[currentConnection.trip].arrivalDate,
                enterTime: currentConnectionDepartureTime,
                enterStop: currentConnection.departureStop,
                exitTime: this.t[currentConnection.trip].connectionArrivalTime,
                exitStop: this.t[currentConnection.trip].connectionArrivalStop,
            }
            
            // loops over all incoming footpaths of the arrival stop and updates the profile functions of the footpath departure stops
            if(p.exitStop !== undefined && p.arrivalTime !== Number.MAX_VALUE) {
                // gets all footpaths of the departure stop
                let footpaths = GoogleTransitData.getAllFootpathsOfAArrivalStop(currentConnection.departureStop);
                for(let footpath of footpaths) {
                    // sets the profile function of the footpath departure stop
                    let pNew: SEntry= {
                        departureTime: currentConnectionDepartureTime - footpath.duration,
                        arrivalTime: p.arrivalTime,
                        departureDate: p.departureDate,
                        arrivalDate: p.arrivalDate,
                        enterTime: p.enterTime,
                        enterStop: p.enterStop,
                        exitTime: p.exitTime,
                        exitStop: p.exitStop,
                        transferFootpath: footpath.idArrival,
                    }
                    // checks if the new departure time undershoots the minimum departure time
                    if(pNew.departureTime < this.minDepartureTime){
                        continue;
                    }
                    // checks if p is not dominated in the profile
                    if(this.notDominatedInProfile(pNew, footpath.departureStop)){
                        let shiftedPairs = [];
                        let currentPair = this.s[footpath.departureStop][0];
                        // shifts the pairs to insert p at the correct place (pairs should be sorted by their departure time)
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
        // sets the footpath to target array
        this.d = new Array(GoogleTransitData.STOPS.length);

        // default entry for each stop
        const defaultSEntry: SEntry = {
            departureTime: Number.MAX_VALUE,
            arrivalTime: Number.MAX_VALUE,
        }
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++) {
            this.s[i] = [defaultSEntry];
            this.d[i] = Number.MAX_VALUE;
        }
        // default entry for each trip
        for(let i = 0; i < this.t.length; i++) {
            this.t[i] = {
                arrivalTime: Number.MAX_VALUE
            };
        }
        // sets the final footpaths of the target stops
        for(let targetStop of this.targetStops){
            let finalFootpaths = GoogleTransitData.getAllFootpathsOfAArrivalStop(targetStop);
            for(let footpath of finalFootpaths){
                if(this.d[footpath.departureStop] > footpath.duration){
                    this.d[footpath.departureStop] = footpath.duration;
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
        if(q.arrivalTime < p.arrivalTime) {
            return true;
        }
        if(q.arrivalTime === p.arrivalTime && q.departureTime > p.departureTime) {
            return true;
        }
        return false;
    }

    /**
     * Checks if p is not dominated in the profile of the given stop.
     * @param p 
     * @param stopId 
     * @returns 
     */
    private static notDominatedInProfile(p: SEntry, stopId: number): boolean{
        for(let q of this.s[stopId]){
            if(this.dominates(q, p)){
                return false;
            }
        }
        return true;
    }

    /**
     * Gets the resulting journey of the profile algorithm.
     * @returns 
     */
    private static getJourney(): JourneyResponse {
        const sections: Section[] = [];
        let s = this.sourceStops[0];
        // gets the earliest arrival time
        let earliestArrivalTime = this.s[s][0].arrivalTime;
        for(let stopId of this.sourceStops){
            if(this.s[stopId][0].arrivalTime < earliestArrivalTime){
                s = stopId;
            }
        }
        let timeS = this.minDepartureTime;
        let foundFinalFootpath = false;
        let trainSectionCounter = 0;
        let departureDate: Date;
        let arrivalDate: Date;
        // loop until it founds the journey to the target stop
        while(!this.targetStops.includes(s)){
            for(let i = 0; i < this.s[s].length; i++) {
                let p = this.s[s][i];
                if(p.departureTime >= timeS){
                    // checks if the target can be reached earlier by a footpath
                    if(this.d[s] + timeS <= p.arrivalTime){
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
                    // adds the incoming footpath section
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
                    // adds the current train section
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
                    // sets the new pointers
                    s = p.exitStop;
                    timeS = p.exitTime;
                    break;
                }
            }
            if(foundFinalFootpath){
                break;
            }
        }
        // creates the journey response information
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
        let earliestArrivalTime = this.s[s][0].arrivalTime;
        for(let stopId of this.sourceStops){
            if(this.s[stopId][0].arrivalTime < earliestArrivalTime){
                s = stopId;
            }
        }
        let timeS = this.minDepartureTime;
        let foundFinalFootpath = false;
        while(!this.targetStops.includes(s)){
            for(let i = 0; i < this.s[s].length; i++) {
                let p = this.s[s][i];
                if(p.departureTime >= timeS){
                    if(this.d[s] + timeS <= p.arrivalTime){
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
}