import express, { response } from 'express';
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Searcher } from "../../data/searcher";
import { Stop } from "../../models/Stop";
import { Footpath } from "../../models/Footpath";
import { JourneyCSA } from "../../models/JourneyCSA";
import { Leg } from "../../models/Leg";
import { Transfer } from "../../models/Transfer";
import { JourneyResponse } from '../../models/JourneyResponse';
import { Section } from '../../models/Section';
import { RaptorAlgorithmController } from './raptorAlgorithmController';

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
            if(!req.query || !req.query.sourceStop || !req.query.targetStop || !req.query.sourceTime || !req.query.date ||
                typeof req.query.sourceStop !== 'string' || typeof req.query.targetStop !== 'string' || typeof req.query.sourceTime !== 'string' || typeof req.query.date !== 'string'){
                res.status(400).send();
                return;
            }
            const sourceStops = GoogleTransitData.getStopIdsByName(req.query.sourceStop);
            const targetStops = GoogleTransitData.getStopIdsByName(req.query.targetStop);
            const sourceTimeInSeconds = Converter.timeToSeconds(req.query.sourceTime)
            const journey = this.performAlgorithm(sourceStops, targetStops, sourceTimeInSeconds);
            const journeyResponse = this.getJourneyResponse(journey, req.query.date);
            res.send(journeyResponse);
        } catch(error) {
            res.status(500).send(error);
        }
    }

    private static performAlgorithm(sourceStops: number[], targetStops: number[], sourceTime: number): JourneyCSA{
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
            if(dayDifference > 2 * (24*3600)){
                console.timeEnd('connection scan algorithm')
                throw new Error('Too many iterations.');
            }
            firstConnectionId = 0;
        }
        
        targetStop = targetStops[0];
        for(let j = 1; j < targetStops.length; j++){
            if(this.s[targetStops[j]] < this.s[targetStop]){
                targetStop = targetStops[j];
            }
        }

        const journey: JourneyCSA = this.getJourney(targetStop, sourceTime);
        console.timeEnd('connection scan algorithm')
        return journey;
    }

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

    private static getJourney(targetStop: number, sourceTime: number): JourneyCSA{
        const journeyPointersOfRoute: JourneyPointer[] = [];

        let currentStop = targetStop;

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
        
        for(let i = journeyPointersOfRoute.length - 1; i >= 0; i--) {
            const enterConnection = GoogleTransitData.CONNECTIONS[journeyPointersOfRoute[i].enterConnection];
            const exitConnection = GoogleTransitData.CONNECTIONS[journeyPointersOfRoute[i].exitConnection];

            const departureStop = GoogleTransitData.STOPS[enterConnection.departureStop];
            const arrivalStop = GoogleTransitData.STOPS[exitConnection.arrivalStop];
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
            
            let duration: string = Converter.secondsToTime(exitConnection.arrivalTime - enterConnection.departureTime);
            
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

    private static getJourneyResponse(journeyCSA: JourneyCSA, date: string): JourneyResponse {
        const sections: Section[] = [];
        for(let i = 0; i < journeyCSA.legs.length - 1; i++) {
            let section: Section = {
                departureTime: Converter.secondsToTime(journeyCSA.legs[i].departureTime),
                arrivalTime: Converter.secondsToTime(journeyCSA.legs[i].arrivalTime),
                duration: journeyCSA.legs[i].duration,
                departureStop: journeyCSA.legs[i].departureStop.name,
                arrivalStop: journeyCSA.legs[i].arrivalStop.name,
                type: 'Train'
            }
            sections.push(section);
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
        let section: Section = {
            departureTime: Converter.secondsToTime(journeyCSA.legs[journeyCSA.legs.length-1].departureTime),
            arrivalTime: Converter.secondsToTime(journeyCSA.legs[journeyCSA.legs.length-1].arrivalTime),
            duration: journeyCSA.legs[journeyCSA.legs.length-1].duration,
            departureStop: journeyCSA.legs[journeyCSA.legs.length-1].departureStop.name,
            arrivalStop: journeyCSA.legs[journeyCSA.legs.length-1].arrivalStop.name,
            type: 'Train'
        }
        sections.push(section)

        let initialDate = new Date(date);
        let departureDate = new Date(initialDate);
        let arrivalDate = new Date(initialDate);
        departureDate.setDate(initialDate.getDate() + Converter.getDayDifference(journeyCSA.legs[0].departureTime))
        arrivalDate.setDate(initialDate.getDate() + Converter.getDayDifference(journeyCSA.legs[journeyCSA.legs.length-1].arrivalTime))
        let departureDateAsString = departureDate.toLocaleDateString();
        let arrivalDateAsString = arrivalDate.toLocaleDateString();
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
