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

interface JourneyPointer {
    enterConnection?: number,
    exitConnection?: number,
    footpath?: number
}

export class ConnectionScanAlgorithmController {
    // earliest arrival time of each stop
    private static s: number[];
    // enter connection of each trip
    private static t: number[];
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
            // initializes the csa algorithm
            this.init(sourceStops, sourceTimeInSeconds);
            // calls the csa
            console.time('connection scan algorithm')
            this.performAlgorithm(targetStops, sourceTimeInSeconds);
            console.timeEnd('connection scan algorithm')
            // gets the journey in csa format
            const journey: JourneyCSA = this.getJourney(targetStops, sourceTimeInSeconds);
            // generates the http response which includes all information of the journey
            const journeyResponse = this.getJourneyResponse(journey, req.query.date);
            res.send(journeyResponse);
        } catch(error) {
            console.timeEnd('connection scan algorithm')
            res.status(500).send(error);
        }
    }

    /**
     * Performs the connection scan algorithm.
     * @param sourceStops 
     * @param targetStops 
     * @param sourceTime 
     * @returns 
     */
    private static performAlgorithm(targetStops: number[], sourceTime: number){
        let reachedTargetStop = false;
        // gets the first connection id
        let firstConnectionId = Searcher.binarySearchOfConnections(sourceTime);
        let dayDifference = 0;
        // while loop until it founds a solution or it checked connections of the next two days
        while(true){
            // loop over all connections
            for(let i = firstConnectionId; i < GoogleTransitData.CONNECTIONS.length; i++){
                let currentConnection = GoogleTransitData.CONNECTIONS[i];
                // sets departure and arrival time
                let currentConnectionDepartureTime = currentConnection.departureTime + dayDifference;
                let currentConnectionArrivalTime = currentConnection.arrivalTime + dayDifference;
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
                
                // checks if the trip is already used or if the trip can be reached at stop s
                if(this.t[currentConnection.trip] !== null || this.s[currentConnection.departureStop] <= currentConnectionDepartureTime){
                    // sets enter connection of a trip
                    if(this.t[currentConnection.trip] === null){
                        this.t[currentConnection.trip] = currentConnection.id;
                    }
                    // checks if the stop can be reached earlier with the current connection
                    if(currentConnectionArrivalTime < this.s[currentConnection.arrivalStop]){
                        // updates the footpaths of the stop
                        let footpaths: Footpath[] = GoogleTransitData.getAllFootpathsOfAStop(currentConnection.arrivalStop);
                        for(let i = 0; i < footpaths.length; i++){
                            if(currentConnectionArrivalTime + footpaths[i].duration < this.s[footpaths[i].arrivalStop]){
                                // sets the earliest arrival time
                                this.s[footpaths[i].arrivalStop] = currentConnectionArrivalTime + footpaths[i].duration;
                                // sets the journey pointer
                                this.j[footpaths[i].arrivalStop] = {
                                    enterConnection: this.t[currentConnection.trip],
                                    exitConnection: currentConnection.id,
                                    footpath: footpaths[i].id
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
            // termination condition
            if(dayDifference > 2 * (24*3600)){
                throw new Error('Too many iterations.');
            }
            firstConnectionId = 0;
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

        this.t = new Array(GoogleTransitData.TRIPS.length);
        for(let i = 0; i < GoogleTransitData.TRIPS.length; i++){
            this.t[i] = null;
        }

        for(let j = 0; j < sourceStops.length; j++){
            const footpathsOfSourceStop = GoogleTransitData.getAllFootpathsOfAStop(sourceStops[j]);
            for(let i = 0; i < footpathsOfSourceStop.length; i++){
                if(this.s[footpathsOfSourceStop[i].arrivalStop] > sourceTime + footpathsOfSourceStop[i].duration){
                    this.s[footpathsOfSourceStop[i].arrivalStop] = sourceTime + footpathsOfSourceStop[i].duration;
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
    private static getJourney(targetStops: number[], sourceTime: number): JourneyCSA{
        // finds the target stop with the earliest arrival time
        let targetStop = targetStops[0];
        for(let j = 1; j < targetStops.length; j++){
            if(this.s[targetStops[j]] < this.s[targetStop]){
                targetStop = targetStops[j];
            }
        }

        const journeyPointersOfRoute: JourneyPointer[] = [];

        let currentStop = targetStop;

        // goes backward until it reaches a source stop which has a undefined journey pointer
        while(this.j[currentStop].enterConnection && this.j[currentStop].exitConnection && this.j[currentStop].footpath){
            journeyPointersOfRoute.push(this.j[currentStop]);
            currentStop = GoogleTransitData.CONNECTIONS[this.j[currentStop].enterConnection].departureStop;
        }

        const journey: JourneyCSA = {
            legs: [],
            transfers: []
        }

        let lastArrivalTime = sourceTime;
        let dayOffset = 0;
        
        // generates the legs and transfers
        for(let i = journeyPointersOfRoute.length - 1; i >= 0; i--) {
            const enterConnection = GoogleTransitData.CONNECTIONS[journeyPointersOfRoute[i].enterConnection];
            const exitConnection = GoogleTransitData.CONNECTIONS[journeyPointersOfRoute[i].exitConnection];

            const departureStop = GoogleTransitData.STOPS[enterConnection.departureStop];
            const arrivalStop = GoogleTransitData.STOPS[exitConnection.arrivalStop];
            // calculates the day difference of departure and arrival time
            let departureTime = enterConnection.departureTime + dayOffset
            if(departureTime < lastArrivalTime){
                dayOffset += (24*3600);
                departureTime += (24*3600);
            }
            let arrivalTime = exitConnection.arrivalTime + dayOffset;
            if(arrivalTime < departureTime){
                dayOffset += (24*3600);
                arrivalTime += (24*3600);
            }
            
            let duration: string = Converter.secondsToTime(arrivalTime - departureTime);
            
            const leg: Leg = {
                departureStop: departureStop,
                arrivalStop: arrivalStop,
                departureTime: departureTime,
                arrivalTime: arrivalTime,
                duration: duration
            }

            journey.legs.push(leg);
            
            const footpath = GoogleTransitData.FOOTPATHS[journeyPointersOfRoute[i].footpath];

            const transfer: Transfer = {
                departureStop: GoogleTransitData.STOPS[footpath.departureStop],
                arrivalStop: GoogleTransitData.STOPS[footpath.arrivalStop],
                duration: footpath.duration
            }

            journey.transfers.push(transfer);
        }
        return journey;
    }

    /**
     * Transforms the journeyCSA to a valid journey http response.
     * @param journeyCSA 
     * @param date 
     * @returns 
     */
    private static getJourneyResponse(journeyCSA: JourneyCSA, date: string): JourneyResponse {
        const sections: Section[] = [];
        //loops over all legs and transfers and uses them to generate sections.
        for(let i = 0; i < journeyCSA.legs.length - 1; i++) {
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
            section = {
                departureTime: Converter.secondsToTime(journeyCSA.legs[i].arrivalTime),
                arrivalTime:  Converter.secondsToTime(journeyCSA.legs[i].arrivalTime + journeyCSA.transfers[i].duration),
                duration: Converter.secondsToTime(journeyCSA.transfers[i].duration),
                departureStop: journeyCSA.transfers[i].departureStop.name,
                arrivalStop: journeyCSA.transfers[i].arrivalStop.name,
                type: 'Footpath'
            }
            sections.push(section);
        }
        // last train connection to the target stop
        let section: Section = {
            departureTime: Converter.secondsToTime(journeyCSA.legs[journeyCSA.legs.length-1].departureTime),
            arrivalTime: Converter.secondsToTime(journeyCSA.legs[journeyCSA.legs.length-1].arrivalTime),
            duration: journeyCSA.legs[journeyCSA.legs.length-1].duration,
            departureStop: journeyCSA.legs[journeyCSA.legs.length-1].departureStop.name,
            arrivalStop: journeyCSA.legs[journeyCSA.legs.length-1].arrivalStop.name,
            type: 'Train'
        }
        sections.push(section)

        // calculates departure and arrival date
        let initialDate = new Date(date);
        let departureDate = new Date(initialDate);
        let arrivalDate = new Date(initialDate);
        departureDate.setDate(initialDate.getDate() + Converter.getDayDifference(journeyCSA.legs[0].departureTime))
        arrivalDate.setDate(initialDate.getDate() + Converter.getDayDifference(journeyCSA.legs[journeyCSA.legs.length-1].arrivalTime))
        let departureDateAsString = departureDate.toLocaleDateString();
        let arrivalDateAsString = arrivalDate.toLocaleDateString();

        // creates the journey response
        const journeyResponse: JourneyResponse = {
            sourceStop: sections[0].departureStop,
            targetStop: sections[sections.length-1].arrivalStop,
            departureTime: sections[0].departureTime,
            arrivalTime: sections[sections.length-1].arrivalTime,
            departureDate: departureDateAsString,
            arrivalDate: arrivalDateAsString,
            changes: Math.floor((sections.length/2)),
            sections: sections
        }
        return journeyResponse;
    }
}
