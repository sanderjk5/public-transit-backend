import express, { response } from 'express';
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Searcher } from "../../data/searcher";
import { Stop } from "../../models/Stop";
import { Footpath } from "../../models/Footpath";
import { Journey } from "../../models/Journey";
import { Leg } from "../../models/Leg";
import { Transfer } from "../../models/Transfer";

interface JourneyPointer {
    enterConnection?: number,
    exitConnection?: number,
    footpath?: number
}

export class ConnectionScanAlgorithmController {
    private static s: number[];
    private static t: number[];
    private static j: JourneyPointer[];

    public static connectionScanAlgorithm(req: express.Request, res: express.Response){
        try {
            if(!req.query || !req.query.sourceStop || !req.query.targetStop || !req.query.sourceTime || 
                typeof req.query.sourceStop !== 'string' || typeof req.query.targetStop !== 'string' || typeof req.query.sourceTime !== 'string'){
                res.status(400).send();
                return;
            }
            const sourceStops = GoogleTransitData.getStopIdsByName(req.query.sourceStop);
            const targetStops = GoogleTransitData.getStopIdsByName(req.query.targetStop);
            const sourceTimeInSeconds = Converter.timeToSeconds(req.query.sourceTime)
            const journey = this.performAlgorithm(sourceStops, targetStops, sourceTimeInSeconds);
            res.send(journey);
        } catch(error) {
            res.status(500).send(error);
        }
        
    }

    private static performAlgorithm(sourceStops: number[], targetStops: number[], sourceTime: number): Journey{
        console.time('connection scan algorithm')
        let targetStop: number = null;
        let reachedTargetStop = false;
        this.init(sourceStops, sourceTime);
        let firstConnectionId = Searcher.binarySearchOfConnections(sourceTime);
        let dayDifference = 0;
        while(true){
            for(let i = firstConnectionId; i < GoogleTransitData.CONNECTIONS.length; i++){
                let currentConnection = GoogleTransitData.CONNECTIONS[i];
                let currentConnectionDepartureTime = currentConnection.departureTime + dayDifference;
                let currentConnectionArrivalTime = currentConnection.arrivalTime + dayDifference;
                if(currentConnectionArrivalTime < currentConnectionDepartureTime) {
                    currentConnectionArrivalTime += (24 * 3600);
                }
                for(let j = 0; j < targetStops.length; j++){
                    if(this.s[targetStops[j]] <= currentConnectionDepartureTime){
                        reachedTargetStop = true;
                        break;
                    }
                }
                if(reachedTargetStop){
                    break;
                }
                
                if(this.t[currentConnection.trip] !== null || this.s[currentConnection.departureStop] <= currentConnectionDepartureTime){
                    if(this.t[currentConnection.trip] === null){
                        this.t[currentConnection.trip] = currentConnection.id;
                    }
                    if(currentConnectionArrivalTime < this.s[currentConnection.arrivalStop]){
                        let footpaths: Footpath[] = GoogleTransitData.getAllFootpathsOfAStop(currentConnection.arrivalStop);
                        for(let i = 0; i < footpaths.length; i++){
                            if(currentConnectionArrivalTime + footpaths[i].duration < this.s[footpaths[i].arrivalStop]){
                                this.s[footpaths[i].arrivalStop] = currentConnectionArrivalTime + footpaths[i].duration;
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
            if(reachedTargetStop){
                break;
            }
            dayDifference += 24 * 3600;
            firstConnectionId = 0;
        }
        
        targetStop = targetStops[0];
        for(let j = 1; j < targetStops.length; j++){
            if(this.s[targetStops[j]] < this.s[targetStop]){
                targetStop = targetStops[j];
            }
        }

        const journey: Journey = this.getJourney(targetStop);
        console.timeEnd('connection scan algorithm')
        return journey;
    }

    private static init(sourceStops: number[], sourceTime: number) {
        this.s = new Array(GoogleTransitData.STOPS.length);
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            this.s[i] = Number.MAX_VALUE;
        }

        this.t = new Array(GoogleTransitData.TRIPS.length);
        for(let i = 0; i < GoogleTransitData.TRIPS.length; i++){
            this.t[i] = null;
        }

        this.j = new Array(GoogleTransitData.STOPS.length);
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            this.j[i] = {
                enterConnection: null,
                exitConnection: null,
                footpath: null
            }
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

    private static getJourney(targetStop: number): Journey{
        const journeyPointersOfRoute: JourneyPointer[] = [];

        let currentStop = targetStop;

        while(this.j[currentStop].enterConnection && this.j[currentStop].exitConnection && this.j[currentStop].footpath){
            journeyPointersOfRoute.push(this.j[currentStop]);
            currentStop = GoogleTransitData.CONNECTIONS[this.j[currentStop].enterConnection].departureStop;
        }

        const journey: Journey = {
            legs: [],
            transfers: []
        }
        
        for(let i = journeyPointersOfRoute.length - 1; i >= 0; i--) {
            const enterConnection = GoogleTransitData.CONNECTIONS[journeyPointersOfRoute[i].enterConnection];
            const exitConnection = GoogleTransitData.CONNECTIONS[journeyPointersOfRoute[i].exitConnection];

            const departureStop = GoogleTransitData.STOPS[enterConnection.departureStop];
            const arrivalStop = GoogleTransitData.STOPS[exitConnection.arrivalStop];
            const departureTime = Converter.secondsToTime(enterConnection.departureTime);
            const arrivalTime = Converter.secondsToTime(exitConnection.arrivalTime);

            const leg: Leg = {
                departureStop: departureStop,
                arrivalStop: arrivalStop,
                departureTime: departureTime,
                arrivalTime: arrivalTime
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
}
