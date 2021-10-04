import express, { response } from 'express';
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Searcher } from "../../data/searcher";
import { Footpath } from "../../models/Footpath";
import { JourneyCSA } from "../../models/JourneyCSA";
import { Leg } from "../../models/Leg";
import { Transfer } from "../../models/Transfer";
import { JourneyResponse } from '../../models/JourneyResponse';
import { Section } from '../../models/Section';
import { performance } from 'perf_hooks';
import { Connection } from '../../models/Connection';
import { Calculator } from '../../data/calculator';
import { SECONDS_OF_A_DAY } from '../../constants';
import { Reliability } from '../../data/reliability';

// Pointer to reconstruct the journey.
interface JourneyPointer {
    enterConnection?: number,
    exitConnection?: number,
    footpath?: number,
    departureDate?: Date,
    arrivalDate?: Date,
    reliability: number,
}

// Entry of the t-Array.
interface TEntry {
    connectionId: number,
    departureDate: Date,
    reliability: number,
}

export class ConnectionScanAlgorithmController {
    // earliest arrival time of each stop
    private static s: number[];
    // enter connection of each trip for previous, current and next day
    private static t: TEntry[][];
    // journey pointer of each stop
    private static j: JourneyPointer[];
    // weekday of previous, current and next day
    private static weekdays: number[];
    // date of previous, current and next day
    private static dates: Date[];
    // index of previous, current and next day
    private static indices: number[];
    // connection of previous, current and next day
    private static connections: Connection[];

    /**
     * Initializes and calls the connection scan algorithm.
     * @param req 
     * @param res 
     * @returns 
     */
    public static connectionScanAlgorithmRoute(req: express.Request, res: express.Response){
        try {
            // checks the parameters of the http request
            if(!req.query || !req.query.sourceStop || !req.query.targetStop || !req.query.sourceTime || !req.query.date ||
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
            // initializes the csa algorithm
            this.init(sourceStops, sourceTimeInSeconds, sourceDate);
            // calls the csa
            console.time('connection scan algorithm')
            this.performAlgorithm(targetStops);
            console.timeEnd('connection scan algorithm')
            // gets the journey in csa format
            const journey: JourneyCSA = this.getJourney(sourceStops, targetStops, sourceTimeInSeconds);
            // generates the http response which includes all information of the journey
            const journeyResponse = this.getJourneyResponse(journey, sourceTimeInSeconds, sourceDate);
            res.send(journeyResponse);
        } catch(error) {
            console.log(error)
            console.timeEnd('connection scan algorithm')
            res.status(500).send(error);
        }
    }

    /**
     * Can be used by the TestController to get the result of a random request.
     * @param sourceStop 
     * @param targetStop 
     * @param sourceDate 
     * @param sourceTimeInSeconds 
     * @returns 
     */
    public static testAlgorithm(sourceStop: string, targetStop: string, sourceDate: Date, sourceTimeInSeconds: number){
        // gets the source and target stops
        const sourceStops = GoogleTransitData.getStopIdsByName(sourceStop);
        const targetStops = GoogleTransitData.getStopIdsByName(targetStop);
        // sets the source Weekday
        try {
            // initializes the csa algorithm
            this.init(sourceStops, sourceTimeInSeconds, sourceDate);
            const startTime = performance.now();
            // calls the csa
            this.performAlgorithm(targetStops);
            const duration = performance.now() - startTime;
            // gets the earliest arrival time at the target stops
            let earliestTargetStopArrival = this.s[targetStops[0]];
            for(let l = 1; l < targetStops.length; l++){
                if(this.s[targetStops[l]] < earliestTargetStopArrival){
                    earliestTargetStopArrival = this.s[targetStops[l]];
                }
            }
            return {arrivalTime: earliestTargetStopArrival, duration: duration};
        } catch (err) {
            return null;
        }
    }

    public static getEarliestArrivalTime(sourceStop: string, targetStop: string, sourceDate: Date, sourceTimeInSeconds: number){
        // gets the source and target stops
        const sourceStops = GoogleTransitData.getStopIdsByName(sourceStop);
        const targetStops = GoogleTransitData.getStopIdsByName(targetStop);
        // sets the source Weekday
        try {
            // initializes the csa algorithm
            this.init(sourceStops, sourceTimeInSeconds, sourceDate);
            // calls the csa
            this.performAlgorithm(targetStops);
            // gets the earliest arrival time at the target stops
            let earliestTargetStopArrival = this.s[targetStops[0]];
            for(let l = 1; l < targetStops.length; l++){
                if(this.s[targetStops[l]] < earliestTargetStopArrival){
                    earliestTargetStopArrival = this.s[targetStops[l]];
                }
            }
            return earliestTargetStopArrival;
        } catch (err) {
            return null;
        }
    }

    /**
     * Performs the connection scan algorithm.
     * @param sourceStops 
     * @param targetStops 
     * @param sourceTime 
     * @returns 
     */
    private static performAlgorithm(targetStops: number[]){
        let reachedTargetStop = false;
        // gets the first connection id
        let dayDifference = 0;
        const numberOfConnections = GoogleTransitData.CONNECTIONS.length;
        // typescript date format starts the week with sunday, gtfs with monday
        let dayOfCurrentConnection: number;
        // while loop until it founds a solution or it checked connections of the next seven days
        for(let i = 0; i < 8; i++){
            // loop over all connections
            while(this.indices[1] < numberOfConnections){
                // sets the next connection of previous, current and next day
                for(let j = 0; j < 3; j++) {
                    if(this.indices[j] < numberOfConnections){
                        this.connections[j] = GoogleTransitData.CONNECTIONS[this.indices[j]];
                    } else {
                        this.connections[j] = null;
                    }
                }
                // sets information of current connection
                dayOfCurrentConnection = this.getNextConnection();
                let currentConnection = this.connections[dayOfCurrentConnection];
                let currentWeekday = this.weekdays[dayOfCurrentConnection];
                let currentDate = this.dates[dayOfCurrentConnection];
                if(dayOfCurrentConnection === 1 && currentConnection.departureTime >= SECONDS_OF_A_DAY){
                    currentDate = this.dates[2];
                }
                this.indices[dayOfCurrentConnection] += 1;
                let dayDifference2 = (dayOfCurrentConnection - 1) * SECONDS_OF_A_DAY;
                
                //checks if the connection is available on this weekday
                let serviceId = GoogleTransitData.TRIPS[currentConnection.trip].serviceId;
                if(!GoogleTransitData.CALENDAR[serviceId].isAvailable[currentWeekday]){
                    continue;
                }
                // sets departure and arrival time
                let currentConnectionDepartureTime = currentConnection.departureTime + dayDifference + dayDifference2;
                let currentConnectionArrivalTime = currentConnection.arrivalTime + dayDifference + dayDifference2;
                // sets departure and arrival date
                let currentDepartureDate = new Date(currentDate);
                let currentArrivalDate = new Date(currentDate);
                if(Converter.getDayDifference(currentConnection.departureTime) === 0 && Converter.getDayDifference(currentConnection.arrivalTime) === 1){
                    currentArrivalDate.setDate(currentArrivalDate.getDate() + 1);
                }

                // checks if it found already a connection for one of the target stops
                reachedTargetStop = this.foundJourneyToTarget(targetStops, currentConnectionDepartureTime);
                // termination condition
                if(reachedTargetStop){
                    break;
                }
                const departureStop = currentConnection.departureStop;
                // checks if the trip is already used or if the trip can be reached at stop s
                if(this.t[dayOfCurrentConnection][currentConnection.trip] !== undefined || this.s[departureStop] <= currentConnectionDepartureTime){
                    // sets enter connection of a trip
                    if(this.t[dayOfCurrentConnection][currentConnection.trip] === undefined){
                        let reliability = 1;
                        if(this.j[departureStop].enterConnection !== null){
                            const bufferTime = currentConnectionDepartureTime - this.s[departureStop];
                            const tripId = GoogleTransitData.CONNECTIONS[this.j[departureStop].enterConnection].trip;
                            reliability = Reliability.getReliability(bufferTime, GoogleTransitData.TRIPS[tripId].isLongDistance)
                        }
                        
                        this.t[dayOfCurrentConnection][currentConnection.trip] = {
                            connectionId: currentConnection.id,
                            departureDate: currentDepartureDate,
                            reliability: this.j[departureStop].reliability * reliability,
                        }
                    }
                    // checks if the stop can be reached earlier with the current connection
                    if(currentConnectionArrivalTime < this.s[currentConnection.arrivalStop]){
                        // updates the footpaths of the stop
                        let footpaths: Footpath[] = GoogleTransitData.getAllFootpathsOfADepartureStop(currentConnection.arrivalStop);
                        for(let j = 0; j < footpaths.length; j++){
                            if(currentConnectionArrivalTime + footpaths[j].duration < this.s[footpaths[j].arrivalStop]){
                                // sets the earliest arrival time
                                this.s[footpaths[j].arrivalStop] = currentConnectionArrivalTime + footpaths[j].duration;
                                // sets the journey pointer
                                this.j[footpaths[j].arrivalStop] = {
                                    enterConnection: this.t[dayOfCurrentConnection][currentConnection.trip].connectionId,
                                    exitConnection: currentConnection.id,
                                    footpath: footpaths[j].id,
                                    departureDate: this.t[dayOfCurrentConnection][currentConnection.trip].departureDate,
                                    arrivalDate: currentArrivalDate,
                                    reliability: this.t[dayOfCurrentConnection][currentConnection.trip].reliability,
                                }
                            }
                        }
                    }
                }
            }
            // termination condition
            if(reachedTargetStop){
                break;
            }
            // tries connections of the next day if it didn't find a journey to one of the target stops
            dayDifference += SECONDS_OF_A_DAY;
            // updates the required arrays
            this.updateArraysForNextRound();
        }
        // throws an error if it didn't find a connection after seven days.
        if(!reachedTargetStop){
            throw new Error("Couldn't find a connection in the next seven days.")
        }
    }

    /**
     * Gets the next connection of previous, current and next day which has the smallest departure time.
     * @returns 
     */
    private static getNextConnection(){
        if(this.connections[0] && ((this.connections[0].departureTime - SECONDS_OF_A_DAY) < this.connections[1].departureTime)) {
            return 0;
        } else if((this.connections[2].departureTime + SECONDS_OF_A_DAY) < this.connections[1].departureTime) {
            return 2;
        } else {
            return 1;
        }
    }

    /**
     * Checks if the stopping criterion of the algorithm is fullfilled.
     * @param targetStops 
     * @param currentConnectionDepartureTime 
     * @returns 
     */
    private static foundJourneyToTarget(targetStops: number[], currentConnectionDepartureTime: number): boolean{
        let reachedTargetStop = false;
        // checks if it found already a connection for one of the target stops
        for(let j = 0; j < targetStops.length; j++){
            if(this.s[targetStops[j]] <= currentConnectionDepartureTime){
                reachedTargetStop = true;
                break;
            }
        }
        return reachedTargetStop;
    }

    /**
     * Updates the arrays.
     */
    private static updateArraysForNextRound() {
        this.t[1] = this.t[2];
        this.t[2] = new Array(GoogleTransitData.TRIPS.length)

        this.weekdays[1] = this.weekdays[2];
        this.weekdays[2] = Calculator.moduloSeven(this.weekdays[2] + 1);

        this.dates[1] = new Date(this.dates[2]);
        this.dates[2].setDate(this.dates[2].getDate() + 1);
        
        this.indices[1] = this.indices[2];
        this.indices[2] = 0;
    }

    /**
     * Initializes the required arrays of the algorithm.
     * @param sourceStops 
     * @param sourceTime 
     */
    private static init(sourceStops: number[], sourceTime: number, sourceDate: Date) {
        this.s = new Array(GoogleTransitData.STOPS.length);
        this.j = new Array(GoogleTransitData.STOPS.length);
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            this.s[i] = Number.MAX_VALUE;
            this.j[i] = {
                enterConnection: null,
                exitConnection: null,
                footpath: null,
                departureDate: null,
                arrivalDate: null,
                reliability: null,
            }
        }

        this.t = new Array(3);
        this.t[0] = new Array(GoogleTransitData.TRIPS.length);
        this.t[1] = new Array(GoogleTransitData.TRIPS.length);
        this.t[2] = new Array(GoogleTransitData.TRIPS.length);

        this.weekdays = new Array(3);
        this.weekdays[0] = Calculator.moduloSeven((sourceDate.getDay() - 2));
        this.weekdays[1] = Calculator.moduloSeven((sourceDate.getDay() - 1));
        this.weekdays[2] = Calculator.moduloSeven((sourceDate.getDay() - 0));
        
        this.dates = new Array(3);
        this.dates[0] = new Date(sourceDate);
        this.dates[1] = new Date(sourceDate);
        this.dates[2] = new Date(sourceDate);
        this.dates[2].setDate(this.dates[2].getDate() + 1);

        this.indices = new Array(3);
        this.indices[0] = Searcher.binarySearchOfConnections(sourceTime + SECONDS_OF_A_DAY);
        this.indices[1] = Searcher.binarySearchOfConnections(sourceTime);
        this.indices[2] = 0;

        this.connections = new Array(3);

        for(let i = 0; i < sourceStops.length; i++){
            const footpathsOfSourceStop = GoogleTransitData.getAllFootpathsOfADepartureStop(sourceStops[i]);
            for(let j = 0; j < footpathsOfSourceStop.length; j++){
                if(this.s[footpathsOfSourceStop[j].arrivalStop] > sourceTime + footpathsOfSourceStop[j].duration){
                    this.s[footpathsOfSourceStop[j].arrivalStop] = sourceTime + footpathsOfSourceStop[j].duration;
                    this.j[footpathsOfSourceStop[j].arrivalStop].footpath = footpathsOfSourceStop[j].id;
                    this.j[footpathsOfSourceStop[j].arrivalStop].reliability = 1;
                    this.j[footpathsOfSourceStop[j].arrivalStop].departureDate = new Date(sourceDate);
                }
            }
        }
        
    }

    /**
     * Reconstructs the journey in csa format from the journey pointers.
     * @param targetStop 
     * @param sourceTime 
     * @returns 
     */
    private static getJourney(sourceStops: number[], targetStops: number[], sourceTime: number): JourneyCSA{
        // finds the target stop with the earliest arrival time
        let targetStop = targetStops[0];
        for(let j = 1; j < targetStops.length; j++){
            if(this.s[targetStops[j]] < this.s[targetStop]){
                targetStop = targetStops[j];
            }
        }

        const journeyPointersOfRoute: JourneyPointer[] = [];
        let currentStop = targetStop;

        // goes backward until it reaches a source stop which has a undefined connection in journey pointer
        while(this.j[currentStop].enterConnection !== null){
            journeyPointersOfRoute.push(this.j[currentStop]);
            currentStop = GoogleTransitData.CONNECTIONS[this.j[currentStop].enterConnection].departureStop;
        }
        // stores the first journey pointer (contains the initial footpath)
        journeyPointersOfRoute.push(this.j[currentStop]);
        if(!sourceStops.includes(GoogleTransitData.FOOTPATHS_SORTED_BY_DEPARTURE_STOP[this.j[currentStop].footpath].departureStop)){
            throw new Error("Couldn't find a connection")
        }

        const journey: JourneyCSA = {
            legs: [],
            transfers: [],
            reliability: journeyPointersOfRoute[0].reliability,
        }
        
        // generates the legs and transfers for the csa journey representation
        for(let i = journeyPointersOfRoute.length - 1; i >= 0; i--) {
            if(journeyPointersOfRoute[i].enterConnection !== null && journeyPointersOfRoute[i].exitConnection !== null){
                const enterConnection = GoogleTransitData.CONNECTIONS[journeyPointersOfRoute[i].enterConnection];
                const exitConnection = GoogleTransitData.CONNECTIONS[journeyPointersOfRoute[i].exitConnection];
                const departureStop = GoogleTransitData.STOPS[enterConnection.departureStop];
                
                const arrivalStop = GoogleTransitData.STOPS[exitConnection.arrivalStop];
                // calculates the day difference of departure and arrival time
                let departureTime = enterConnection.departureTime;
                let arrivalTime = exitConnection.arrivalTime;
                const departureDate = journeyPointersOfRoute[i].departureDate;
                const arrivalDate = journeyPointersOfRoute[i].arrivalDate;
                
                let duration: string = Converter.secondsToTime(arrivalTime - departureTime);
                
                const leg: Leg = {
                    departureStop: departureStop,
                    arrivalStop: arrivalStop,
                    departureTime: departureTime,
                    arrivalTime: arrivalTime,
                    duration: duration,
                    departureDate: departureDate,
                    arrivalDate: arrivalDate,
                }
                journey.legs.push(leg); 
            }

            

            if(journeyPointersOfRoute[i].footpath !== null){
                const footpath = GoogleTransitData.FOOTPATHS_SORTED_BY_DEPARTURE_STOP[journeyPointersOfRoute[i].footpath];

                const transfer: Transfer = {
                    departureStop: GoogleTransitData.STOPS[footpath.departureStop],
                    arrivalStop: GoogleTransitData.STOPS[footpath.arrivalStop],
                    duration: footpath.duration
                }
    
                journey.transfers.push(transfer);
            }
        }
        return journey;
    }

    /**
     * Transforms the journeyCSA to a valid journey http response.
     * @param journeyCSA 
     * @param initialDate 
     * @returns 
     */
    private static getJourneyResponse(journeyCSA: JourneyCSA, sourceTime: number, sourceDate: Date): JourneyResponse {
        const sections: Section[] = [];
        // adds the first transfer if it is a footpath between different stops
        if(journeyCSA.transfers[0].departureStop.name !== journeyCSA.transfers[0].arrivalStop.name){
            let section = {
                departureTime: Converter.secondsToTime(sourceTime),
                arrivalTime:  Converter.secondsToTime(sourceTime + journeyCSA.transfers[0].duration),
                duration: Converter.secondsToTime(journeyCSA.transfers[0].duration),
                departureStop: journeyCSA.transfers[0].departureStop.name,
                arrivalStop: journeyCSA.transfers[0].arrivalStop.name,
                type: 'Footpath'
            }
            sections.push(section);
        }
        
        //loops over all legs and transfers and uses them to generate sections.
        for(let i = 0; i < journeyCSA.legs.length; i++) {
            // train connection
            let section: Section = {
                departureTime: Converter.secondsToTime(journeyCSA.legs[i].departureTime),
                arrivalTime: Converter.secondsToTime(journeyCSA.legs[i].arrivalTime),
                duration: journeyCSA.legs[i].duration,
                departureStop: journeyCSA.legs[i].departureStop.name,
                arrivalStop: journeyCSA.legs[i].arrivalStop.name,
                type: 'Train'
            }
            sections.push(section);
            // following footpath
            // doesn't add the last footpath if it is a footpath inside a stop
            if(i < journeyCSA.legs.length-1 || journeyCSA.transfers[i+1].departureStop.name !== journeyCSA.transfers[i+1].arrivalStop.name){
                section = {
                    departureTime: Converter.secondsToTime(journeyCSA.legs[i].arrivalTime),
                    arrivalTime:  Converter.secondsToTime(journeyCSA.legs[i].arrivalTime + journeyCSA.transfers[i+1].duration),
                    duration: Converter.secondsToTime(journeyCSA.transfers[i+1].duration),
                    departureStop: journeyCSA.transfers[i+1].departureStop.name,
                    arrivalStop: journeyCSA.transfers[i+1].arrivalStop.name,
                    type: 'Footpath'
                }
                sections.push(section);
            }
        }
        
        // calculates departure and arrival date
        let departureDateAsString: string;
        let arrivalDateAsString: string
        if(journeyCSA.legs[0]){
            departureDateAsString = journeyCSA.legs[0].departureDate.toLocaleDateString('de-DE');
            arrivalDateAsString = journeyCSA.legs[journeyCSA.legs.length-1].arrivalDate.toLocaleDateString('de-DE');
        } else {
            departureDateAsString = sourceDate.toLocaleDateString('de-DE');
            if(sourceTime + journeyCSA.transfers[0].duration >= SECONDS_OF_A_DAY){
                sourceDate.setDate(sourceDate.getDate() + 1);
            }
            arrivalDateAsString = sourceDate.toLocaleDateString('de-DE');
        }
        const reliability = Math.floor(journeyCSA.reliability * 100)
        // creates the journey response
        const journeyResponse: JourneyResponse = {
            sourceStop: sections[0].departureStop,
            targetStop: sections[sections.length-1].arrivalStop,
            departureTime: sections[0].departureTime,
            arrivalTime: sections[sections.length-1].arrivalTime,
            departureDate: departureDateAsString,
            arrivalDate: arrivalDateAsString,
            changes: Math.max(journeyCSA.legs.length-1, 0),
            sections: sections,
            reliability: reliability.toString() + '%',
        }
        return journeyResponse;
    }
}