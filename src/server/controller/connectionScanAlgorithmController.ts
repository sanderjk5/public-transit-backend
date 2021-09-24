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

interface JourneyPointer {
    enterConnection?: number,
    exitConnection?: number,
    footpath?: number
}

export class ConnectionScanAlgorithmController {
    // earliest arrival time of each stop
    private static s: number[];
    // enter connection of each trip
    private static tCurrentDay: number[];
    private static tPreviousDay: number[];
    private static tNextDay: number[];
    // journey pointer of each stop
    private static j: JourneyPointer[];

    /**
     * Initializes and calls the connection scan algorithm.
     * @param req 
     * @param res 
     * @returns 
     */
    public static connectionScanAlgorithm(req: express.Request, res: express.Response){
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
            this.init(sourceStops, sourceTimeInSeconds);
            // calls the csa
            console.time('connection scan algorithm')
            this.performAlgorithm(targetStops, sourceTimeInSeconds, sourceDate);
            console.timeEnd('connection scan algorithm')
            // gets the journey in csa format
            const journey: JourneyCSA = this.getJourney(sourceStops, targetStops, sourceTimeInSeconds);
            // generates the http response which includes all information of the journey
            const journeyResponse = this.getJourneyResponse(journey, sourceDate, sourceTimeInSeconds);
            res.send(journeyResponse);
        } catch(error) {
            console.log(error)
            console.timeEnd('connection scan algorithm')
            res.status(500).send(error);
        }
    }

    public static testAlgorithm(sourceStop: string, targetStop: string, sourceDate: Date, sourceTimeInSeconds: number){
        // gets the source and target stops
        const sourceStops = GoogleTransitData.getStopIdsByName(sourceStop);
        const targetStops = GoogleTransitData.getStopIdsByName(targetStop);
        // sets the source Weekday
        try {
            // initializes the csa algorithm
            this.init(sourceStops, sourceTimeInSeconds);
            const startTime = performance.now();
            // calls the csa
            this.performAlgorithm(targetStops, sourceTimeInSeconds, sourceDate);
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

    /**
     * Performs the connection scan algorithm.
     * @param sourceStops 
     * @param targetStops 
     * @param sourceTime 
     * @returns 
     */
    private static performAlgorithm(targetStops: number[], sourceTime: number, sourceDate: Date){
        // typescript date format starts the week with sunday, gtfs with monday
        let weekday = (sourceDate.getDay() - 1) % 7;
        //console.log(weekday);
        let reachedTargetStop = false;
        // gets the first connection id
        let dayDifference = 0;
        const numberOfConnections = GoogleTransitData.CONNECTIONS.length;
        let currentDayIndex = Searcher.binarySearchOfConnections(sourceTime);
        let nextDayIndex = 0;
        let previousDayIndex = Searcher.binarySearchOfConnections(sourceTime + (24*3600));
        let dayOfCurrentConnection;
        // while loop until it founds a solution or it checked connections of the next two days
        while(true){
            // loop over all connections
            while(currentDayIndex < numberOfConnections){
                let currentDayConnection = GoogleTransitData.CONNECTIONS[currentDayIndex];
                let nextDayConnection = GoogleTransitData.CONNECTIONS[nextDayIndex];
                let previousDayConnection: Connection;
                let currentConnection: Connection;
                let dayDifference2 = 0;
                if(previousDayIndex  < numberOfConnections){
                    previousDayConnection = GoogleTransitData.CONNECTIONS[previousDayIndex];
                }
                if(previousDayConnection && ((previousDayConnection.departureTime - (24*3600)) < currentDayConnection.departureTime)) {
                    currentConnection = previousDayConnection;
                    previousDayIndex++;
                    dayDifference2 = -(24*3600);
                    dayOfCurrentConnection = -1;
                } else if((nextDayConnection.departureTime + (24*3600)) < currentDayConnection.departureTime) {
                    currentConnection = nextDayConnection;
                    nextDayIndex++;
                    dayDifference2 = (24*3600);
                    dayOfCurrentConnection = 1;
                } else {
                    currentConnection = currentDayConnection;
                    currentDayIndex++;
                    dayOfCurrentConnection = 0;
                }

                let serviceId = GoogleTransitData.TRIPS[currentConnection.trip].serviceId;
                if(currentConnection.trip === 22235){
                    //console.log(!GoogleTransitData.CALENDAR[serviceId].isAvailable[weekday])
                }
                if(!GoogleTransitData.CALENDAR[serviceId].isAvailable[weekday]){
                    //continue;
                }
                // sets departure and arrival time
                let currentConnectionDepartureTime = currentConnection.departureTime + dayDifference + dayDifference2;
                let currentConnectionArrivalTime = currentConnection.arrivalTime + dayDifference + dayDifference2;
                if(currentConnectionArrivalTime < currentConnectionDepartureTime) {
                    currentConnectionArrivalTime += (24 * 3600);
                }
                // checks if it found already a connection for one of the target stops
                for(let j = 0; j < targetStops.length; j++){
                    if(this.s[targetStops[j]] <= currentConnectionDepartureTime){
                        reachedTargetStop = true;
                        break;
                    }
                }
                // termination condition
                if(reachedTargetStop){
                    break;
                }
                
                let currentTrip: number; 
                if(dayOfCurrentConnection === -1){
                    currentTrip = this.tPreviousDay[currentConnection.trip];
                } else if (dayOfCurrentConnection === 0) {
                    currentTrip = this.tCurrentDay[currentConnection.trip];
                } else if (dayOfCurrentConnection === 1) {
                    currentTrip = this.tNextDay[currentConnection.trip];
                }
                // checks if the trip is already used or if the trip can be reached at stop s
                if(currentTrip !== undefined || this.s[currentConnection.departureStop] <= currentConnectionDepartureTime){
                    // sets enter connection of a trip
                    if(currentTrip === undefined){
                        if(dayOfCurrentConnection === -1){
                            this.tPreviousDay[currentConnection.trip] = currentConnection.id;
                        } else if (dayOfCurrentConnection === 0) {
                            this.tCurrentDay[currentConnection.trip] = currentConnection.id;
                        } else if (dayOfCurrentConnection === 1) {
                            this.tNextDay[currentConnection.trip] = currentConnection.id;
                        }
                    }
                    // checks if the stop can be reached earlier with the current connection
                    if(currentConnectionArrivalTime < this.s[currentConnection.arrivalStop]){
                        // updates the footpaths of the stop
                        let footpaths: Footpath[] = GoogleTransitData.getAllFootpathsOfAStop(currentConnection.arrivalStop);
                        for(let j = 0; j < footpaths.length; j++){
                            if(currentConnectionArrivalTime + footpaths[j].duration < this.s[footpaths[j].arrivalStop]){
                                // sets the earliest arrival time
                                this.s[footpaths[j].arrivalStop] = currentConnectionArrivalTime + footpaths[j].duration;
                                // sets the journey pointer
                                let enterConnection: number;
                                if(dayOfCurrentConnection === -1){
                                    enterConnection = this.tPreviousDay[currentConnection.trip];
                                } else if (dayOfCurrentConnection === 0) {
                                    enterConnection = this.tCurrentDay[currentConnection.trip];
                                } else if (dayOfCurrentConnection === 1) {
                                    enterConnection = this.tNextDay[currentConnection.trip];
                                }
                                this.j[footpaths[j].arrivalStop] = {
                                    enterConnection: enterConnection,
                                    exitConnection: currentConnection.id,
                                    footpath: footpaths[j].id
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
            // tries connections of the next day if it didn't find a journey to one of the target stops.
            dayDifference += 24 * 3600;
            weekday = (weekday + 1) % 7;
            //console.log(weekday);
            // termination condition
            if(dayDifference > 4 * (24*3600)){
                throw new Error('Too many iterations.');
            }

            this.tCurrentDay = this.tNextDay;
            this.tNextDay = new Array(GoogleTransitData.TRIPS.length);
            
            currentDayIndex = nextDayIndex;
            //console.log(currentDayIndex)
            nextDayIndex = 0;
            
        }
        
    }

    /**
     * Initializes the required array of the algorithm.
     * @param sourceStops 
     * @param sourceTime 
     */
    private static init(sourceStops: number[], sourceTime: number) {
        this.s = new Array(GoogleTransitData.STOPS.length);
        this.j = new Array(GoogleTransitData.STOPS.length);
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            this.s[i] = Number.MAX_VALUE;
            this.j[i] = {
                enterConnection: null,
                exitConnection: null,
                footpath: null
            }
        }

        this.tCurrentDay = new Array(GoogleTransitData.TRIPS.length);
        this.tPreviousDay = new Array(GoogleTransitData.TRIPS.length);
        this.tNextDay = new Array(GoogleTransitData.TRIPS.length);

        for(let j = 0; j < sourceStops.length; j++){
            const footpathsOfSourceStop = GoogleTransitData.getAllFootpathsOfAStop(sourceStops[j]);
            for(let i = 0; i < footpathsOfSourceStop.length; i++){
                if(this.s[footpathsOfSourceStop[i].arrivalStop] > sourceTime + footpathsOfSourceStop[i].duration){
                    this.s[footpathsOfSourceStop[i].arrivalStop] = sourceTime + footpathsOfSourceStop[i].duration;
                    this.j[footpathsOfSourceStop[i].arrivalStop].footpath = footpathsOfSourceStop[i].id;
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
        // console.log(GoogleTransitData.STOPS[targetStop]);
        // console.log(Converter.secondsToTime(this.s[targetStop]))
        let currentStop = targetStop;

        // goes backward until it reaches a source stop which has a undefined connection in journey pointer
        while(this.j[currentStop].enterConnection){
            journeyPointersOfRoute.push(this.j[currentStop]);
            currentStop = GoogleTransitData.CONNECTIONS[this.j[currentStop].enterConnection].departureStop;
        }
        // stores the first journey pointer (contains the initial footpath)
        journeyPointersOfRoute.push(this.j[currentStop]);
        if(!sourceStops.includes(GoogleTransitData.FOOTPATHS[this.j[currentStop].footpath].departureStop)){
            throw new Error("Couldn't find a connection")
            
        }
        // console.log(journeyPointersOfRoute);

        const journey: JourneyCSA = {
            legs: [],
            transfers: []
        }

        let lastArrivalTime = sourceTime;
        
        // generates the legs and transfers for the csa journey representation
        for(let i = journeyPointersOfRoute.length - 1; i >= 0; i--) {
            // console.log(this.s[4743])
            // console.log(GoogleTransitData.STOPS[4743])
            if(journeyPointersOfRoute[i].enterConnection && journeyPointersOfRoute[i].exitConnection){
                const enterConnection = GoogleTransitData.CONNECTIONS[journeyPointersOfRoute[i].enterConnection];
                const exitConnection = GoogleTransitData.CONNECTIONS[journeyPointersOfRoute[i].exitConnection];
                const departureStop = GoogleTransitData.STOPS[enterConnection.departureStop];
                
                const arrivalStop = GoogleTransitData.STOPS[exitConnection.arrivalStop];
                // calculates the day difference of departure and arrival time
                let departureTime = enterConnection.departureTime;
                while(departureTime < lastArrivalTime){
                    departureTime += (24*3600);
                }
                let arrivalTime = exitConnection.arrivalTime;
                while(arrivalTime < departureTime){
                    arrivalTime += (24*3600);
                }
                // console.log('departureTime: ' + departureTime)
                // console.log('arrivalTime: ' + arrivalTime)
                // console.log(GoogleTransitData.STOPS[enterConnection.departureStop].name);
                // //console.log(GoogleTransitData.STOPS[enterConnection.arrivalStop].name);
                // console.log(Converter.secondsToTime(enterConnection.departureTime));
                //console.log(enterConnection.trip);
                // // console.log(exitConnection.trip);
                // //console.log(GoogleTransitData.STOPS[exitConnection.departureStop].name);
                // console.log(arrivalStop.name);
                // console.log(Converter.secondsToTime(exitConnection.arrivalTime));
                lastArrivalTime = arrivalTime;
                
                let duration: string = Converter.secondsToTime(arrivalTime - departureTime);
                
                const leg: Leg = {
                    departureStop: departureStop,
                    arrivalStop: arrivalStop,
                    departureTime: departureTime,
                    arrivalTime: arrivalTime,
                    duration: duration
                }
    
                journey.legs.push(leg); 
            }

            if(journeyPointersOfRoute[i].footpath){
                const footpath = GoogleTransitData.FOOTPATHS[journeyPointersOfRoute[i].footpath];

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
    private static getJourneyResponse(journeyCSA: JourneyCSA, initialDate: Date, sourceTime: number): JourneyResponse {
        const sections: Section[] = [];
        let initialFootpath = 0;
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
            initialFootpath = journeyCSA.transfers[0].duration;
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
        
        let initialDayDifference = Converter.getDayDifference(journeyCSA.legs[0].departureTime);
        if(journeyCSA.legs[0].departureTime - (initialDayDifference * 24 *3600) < (sourceTime + initialFootpath)){
            initialDayDifference = 0;
        }
        // calculates departure and arrival date
        let departureDate = new Date(initialDate);
        let arrivalDate = new Date(initialDate);
        departureDate.setDate(initialDate.getDate() + Converter.getDayDifference(journeyCSA.legs[0].departureTime) - initialDayDifference)
        //console.log(journeyCSA.legs[journeyCSA.legs.length-1].arrivalTime)
        arrivalDate.setDate(initialDate.getDate() + Converter.getDayDifference(journeyCSA.legs[journeyCSA.legs.length-1].arrivalTime) - initialDayDifference)
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
            changes: journeyCSA.legs.length-1,
            sections: sections
        }
        return journeyResponse;
    }
}
