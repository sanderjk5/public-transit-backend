import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { RouteStopMapping } from "../../models/RouteStopMapping";
import { StopTime } from "../../models/StopTime";
import { Sorter } from "../../data/sorter";
import { JourneyResponse } from "../../models/JourneyResponse";
import { Section } from "../../models/Section";
import express from "express";

interface QEntry {
    r: number,
    p: number,
    stopSequence: number
}

interface EarliestTripInfo {
    tripId: number,
    tripDeparture: number,
    dayOffset: number
}

interface JourneyPointer {
    enterTripAtStop: number,
    exitTripAtStop?: number,
    departureTime: number,
    arrivalTime: number,
    tripId: number,
    footpath: number,
}

export class RaptorAlgorithmController {
    private static earliestArrivalTimePerRound: number[][];
    private static earliestArrivalTime: number[];
    private static markedStops: number[];
    private static Q: QEntry[];
    private static j: JourneyPointer[];

    public static raptorAlgorithm(req: express.Request, res: express.Response){
        try {
            if(!req.query || !req.query.sourceStop || !req.query.targetStop || !req.query.sourceTime || 
                typeof req.query.sourceStop !== 'string' || typeof req.query.targetStop !== 'string' || typeof req.query.sourceTime !== 'string' || typeof req.query.date !== 'string'){
                res.status(400).send();
                return;
            }
            const sourceStops = GoogleTransitData.getStopIdsByName(req.query.sourceStop);
            const targetStops = GoogleTransitData.getStopIdsByName(req.query.targetStop);
            const sourceTimeInSeconds = Converter.timeToSeconds(req.query.sourceTime)
            this.init(sourceStops, sourceTimeInSeconds);
            console.time('raptor algorithm')
            this.performAlgorithm(targetStops);
            console.timeEnd('raptor algorithm')
            const journeyResponse = this.getJourneyResponse(sourceStops, targetStops, req.query.date);
            res.status(200).send(journeyResponse);
        } catch (err) {
            console.timeEnd('raptor algorithm')
            res.status(500).send(err);
        }
        
    }

    private static performAlgorithm(targetStops: number[]){
        let k = 0;
        while(true){
            k++;
            this.addNextArrivalTimeRound();
            
            this.Q = [];
            let qTemp: QEntry[] = [];
            let routeSequenceMinima = new Array(GoogleTransitData.ROUTES.length);
            while(this.markedStops.length > 0){
                let markedStop = this.markedStops.pop();
                let routesServingStop: RouteStopMapping[] = GoogleTransitData.ROUTESSERVINGSTOPS[markedStop];
                for(let i = 0; i < routesServingStop.length; i++) {
                    let routeId = routesServingStop[i].routeId;
                    let stopSequence = routesServingStop[i].stopSequence;
                    if(!routeSequenceMinima[routeId] || stopSequence < routeSequenceMinima[routeId]){
                        routeSequenceMinima[routeId] = stopSequence;
                    }
                    qTemp.push({r: routeId, p: markedStop, stopSequence: stopSequence});
                }
            }
            for(let i = 0; i < qTemp.length; i++){
                let qEntry = qTemp[i];
                if(routeSequenceMinima[qEntry.r] === qEntry.stopSequence){
                    this.Q.push(qEntry);
                    routeSequenceMinima[qEntry.r] = - 1;
                }
            }

            for(let i= 0; i < this.Q.length; i++){
                let r = this.Q[i].r;
                let p = this.Q[i].p;
                let tripInfo = this.getEarliestTrip(r, p, k);
                let t = tripInfo.tripId;
                let enterTripAtStop = p;
                if(!t){
                    continue;
                }
                let reachedP = false;
                for(let j = 0; j < GoogleTransitData.STOPSOFAROUTE[r].length; j++){
                    let pi = GoogleTransitData.STOPSOFAROUTE[r][j];
                    if(pi === p){
                        reachedP = true;
                        continue;
                    }
                    if(!reachedP){
                        continue;
                    }
                    
                    let stopTime = GoogleTransitData.getStopTimeByTripAndStop(t, pi);
                    
                    if(!stopTime){
                        continue;
                    }
                    
                    let arrivalTime = stopTime.arrivalTime + tripInfo.dayOffset;
                    let departureTime = stopTime.departureTime + tripInfo.dayOffset;
                    if(arrivalTime < tripInfo.tripDeparture){
                        arrivalTime += (24*3600);
                    }
                    if(departureTime < tripInfo.tripDeparture){
                        departureTime += (24*3600);
                    }
                    
                    let earliestTargetStopArrival = this.earliestArrivalTime[targetStops[0]];
                    for(let l = 1; l < targetStops.length; l++){
                        if(this.earliestArrivalTime[targetStops[i]] < earliestTargetStopArrival){
                            earliestTargetStopArrival = this.earliestArrivalTime[targetStops[i]];
                        }
                    }
                    if(stopTime && arrivalTime < Math.min(this.earliestArrivalTime[pi], earliestTargetStopArrival)){
                        this.earliestArrivalTimePerRound[k][pi] = arrivalTime;
                        this.earliestArrivalTime[pi] = arrivalTime;
                        this.j[pi] = {
                            enterTripAtStop: enterTripAtStop,
                            departureTime: tripInfo.tripDeparture,
                            arrivalTime: arrivalTime,
                            tripId: t,
                            footpath: null
                        }
                        if(!this.markedStops.includes(pi)){
                            this.markedStops.push(pi);
                        }
                    }
                    
                    if(stopTime && this.earliestArrivalTimePerRound[k-1][pi] < departureTime){
                        let newT = this.getEarliestTrip(r, pi, k);
                        if(newT && newT.tripId !== t){
                            tripInfo = newT;
                            t = tripInfo.tripId;
                            enterTripAtStop = stopTime.stopId;
                        }
                    }
                }
            }
            
            let numberOfMarkedStops = this.markedStops.length;
            for(let i = 0; i < numberOfMarkedStops; i++){
                let markedStop = this.markedStops[i];
                let footPaths = GoogleTransitData.getAllFootpathsOfAStop(markedStop);
                for(let j = 0; j < footPaths.length; j++){
                    let p = footPaths[j].departureStop;
                    let pN = footPaths[j].arrivalStop;
                    if(p !== pN && this.earliestArrivalTimePerRound[k][pN] > (this.earliestArrivalTimePerRound[k][p] + footPaths[j].duration)){
                        this.earliestArrivalTimePerRound[k][pN] = this.earliestArrivalTimePerRound[k][p] + footPaths[j].duration;
                        if(!this.markedStops.includes(pN)){
                            this.markedStops.push(pN);
                        }
                        if(this.earliestArrivalTimePerRound[k][pN] < this.earliestArrivalTime[pN]){
                            this.earliestArrivalTime[pN] = this.earliestArrivalTimePerRound[k][pN];
                            this.j[pN] = {
                                enterTripAtStop: p,
                                departureTime: this.earliestArrivalTimePerRound[k][p],
                                arrivalTime: this.earliestArrivalTime[pN],
                                tripId: null,
                                footpath: footPaths[j].id
                            }
                        }
                    }
                }
            }

            if(this.markedStops.length === 0){
                break;
            }
        }

    }

    private static init(sourceStops: number[], sourceTime: number){
        const numberOfStops = GoogleTransitData.STOPS.length;
        const firstRoundTimes = new Array(numberOfStops);
        this.earliestArrivalTimePerRound = [];
        this.earliestArrivalTime = new Array(numberOfStops);
        this.markedStops = [];
        this.j = new Array(numberOfStops);

        for(let i = 0; i < numberOfStops; i++){
            firstRoundTimes[i] = Number.MAX_VALUE;
            this.earliestArrivalTime[i] = Number.MAX_VALUE;
        }

        for(let i = 0; i < sourceStops.length; i++) {
            let sourceStop = sourceStops[i];
            firstRoundTimes[sourceStop] = sourceTime;
            this.earliestArrivalTime[sourceStop] = sourceTime;
            this.markedStops.push(sourceStop);
        }
        
        this.earliestArrivalTimePerRound.push(firstRoundTimes);

        for(let i = 0; i < sourceStops.length; i++) {
            let sourceStop = sourceStops[i];
            let sourceFootpaths = GoogleTransitData.getAllFootpathsOfAStop(sourceStop);
            for(let j = 0; j < sourceFootpaths.length; j++){
                let p = sourceFootpaths[j].departureStop;
                let pN = sourceFootpaths[j].arrivalStop;
                if(p !== pN && this.earliestArrivalTimePerRound[0][pN] > (this.earliestArrivalTimePerRound[0][p] + sourceFootpaths[j].duration)){
                    this.earliestArrivalTimePerRound[0][pN] = this.earliestArrivalTimePerRound[0][p] + sourceFootpaths[j].duration;
                    this.markedStops.push(pN);
                    if(this.earliestArrivalTimePerRound[0][pN] < this.earliestArrivalTime[pN]){
                        this.earliestArrivalTime[pN] = this.earliestArrivalTimePerRound[0][pN];
                    }
                }
            }
        }
    }

    private static addNextArrivalTimeRound() {
        const numberOfStops = GoogleTransitData.STOPS.length;
        const nextRoundTimes = new Array(numberOfStops)
        for(let i = 0; i < numberOfStops; i++){
            nextRoundTimes[i] = Number.MAX_VALUE;
        }
        this.earliestArrivalTimePerRound.push(nextRoundTimes);
    }

    private static getEarliestTrip(r: number, pi: number, k: number): EarliestTripInfo {
        let tripId: number; 
        let tripDeparture: number;
        let earliestTripInfo: EarliestTripInfo;
        
        let stopTimes: StopTime[] = GoogleTransitData.getStopTimesByStopAndRoute(pi, r);
        stopTimes.sort((a: StopTime, b: StopTime) => {
            return Sorter.sortStopTimesByDeparture(a, b);
        })
        let earliestArrival = this.earliestArrivalTimePerRound[k-1][pi];
        let earliestArrivalDayOffset = Converter.getDayOffset(earliestArrival);
        
        for(let i = 0; i < stopTimes.length; i++) {
            let stopTime = stopTimes[i];
            if(stopTime.departureTime + earliestArrivalDayOffset > earliestArrival) {
                tripId = stopTime.tripId;
                tripDeparture = stopTime.departureTime + earliestArrivalDayOffset;
                break;
            }
        }
        
        if(tripId){
            earliestTripInfo = {
                tripId: tripId,
                tripDeparture: tripDeparture,
                dayOffset: earliestArrivalDayOffset
            }
        } else if(stopTimes.length > 0){
            earliestTripInfo = {
                tripId: stopTimes[0].tripId,
                tripDeparture: stopTimes[0].departureTime + earliestArrivalDayOffset + (24*3600),
                dayOffset: earliestArrivalDayOffset + (24*3600)
            }
        } else {
            earliestTripInfo = {
                tripId: null,
                tripDeparture: null,
                dayOffset: null
            }
        }
        
        return earliestTripInfo;
    }

    private static getJourneyResponse(sourceStops: number[], targetStops: number[], date: string): JourneyResponse {
        let earliestTargetStopArrival = this.earliestArrivalTime[targetStops[0]];
        let earliestTargetStopId = targetStops[0];
        for(let i = 1; i < targetStops.length; i++){
            if(this.earliestArrivalTime[targetStops[i]] < earliestTargetStopArrival){
                earliestTargetStopArrival = this.earliestArrivalTime[targetStops[i]];
                earliestTargetStopId = targetStops[i];
            }
        }
        let journeyPointers: JourneyPointer[] = []
        let stopId = earliestTargetStopId;
        while(!sourceStops.includes(stopId)){
            this.j[stopId].exitTripAtStop = stopId;
            journeyPointers.push(this.j[stopId]);
            stopId = this.j[stopId].enterTripAtStop;
        }

        const sections: Section[] = []
        for(let i = (journeyPointers.length - 1); i >= 0; i--){
            let departureTime = journeyPointers[i].departureTime;
            let arrivalTime = journeyPointers[i].arrivalTime;
            let arrivalStop = journeyPointers[i].exitTripAtStop;
            let type = 'Train'
            if(journeyPointers[i].footpath !== null) {
                type = 'Footpath'
            }
            let section: Section = {
                departureTime: Converter.secondsToTime(departureTime),
                arrivalTime: Converter.secondsToTime(arrivalTime),
                departureStop: GoogleTransitData.STOPS[journeyPointers[i].enterTripAtStop].name,
                arrivalStop: GoogleTransitData.STOPS[arrivalStop].name,
                duration: Converter.secondsToTime((arrivalTime - departureTime)),
                type: type
            }
            sections.push(section);
            if(i > 0){
                let nextDepartureStop = journeyPointers[i-1].enterTripAtStop;
                if(arrivalStop === nextDepartureStop && type === 'Train' && journeyPointers[i-1].footpath === null){
                    let stopName = GoogleTransitData.STOPS[nextDepartureStop].name;
                    let section: Section = {
                        departureTime: Converter.secondsToTime(arrivalTime),
                        arrivalTime: Converter.secondsToTime(arrivalTime),
                        departureStop: stopName,
                        arrivalStop: stopName,
                        duration: Converter.secondsToTime(0),
                        type: 'Footpath'
                    }
                    sections.push(section);
                }
            }
        }

        let initialDate = new Date(date);
        let departureDate = new Date(initialDate);
        let arrivalDate = new Date(initialDate);
        departureDate.setDate(initialDate.getDate() + Converter.getDayDifference(journeyPointers[journeyPointers.length-1].departureTime))
        arrivalDate.setDate(initialDate.getDate() + Converter.getDayDifference(journeyPointers[0].arrivalTime))
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