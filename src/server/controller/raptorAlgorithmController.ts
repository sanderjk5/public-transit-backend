import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { RouteStopMapping } from "../../models/RouteStopMapping";
import { StopTime } from "../../models/StopTime";
import { performance } from 'perf_hooks';

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

export class RaptorAlgorithmController {
    private static earliestArrivalTimePerRound: number[][];
    private static earliestArrivalTime: number[];
    private static markedStops: number[];
    private static Q: QEntry[];

    private static timePart1;
    private static timePart2;
    private static timePart3;
    private static timeEt;

    public static raptorAlgorithm(sourceStop: string, targetStop: string, sourceTime: string){
        console.time('raptor algorithm')
        const sourceTimeInSeconds = Converter.timeToSeconds(sourceTime);
        const sourceStops = GoogleTransitData.getStopIdsByName(sourceStop);
        const targetStops = GoogleTransitData.getStopIdsByName(targetStop);
        this.init(sourceStops, sourceTimeInSeconds);
        this.performAlgorithm(targetStops);
        console.log('Results:')
        for(let i = 0; i < targetStops.length; i++){
            console.log(Converter.secondsToTime(this.earliestArrivalTime[targetStops[i]]));
        }
        console.timeEnd('raptor algorithm')
        
    }

    private static performAlgorithm(targetStops: number[]){
        let k = 0;
        while(true){
            this.timePart1 = 0;
            this.timePart2 = 0;
            this.timePart3 = 0;
            this.timeEt = 0;
            k++;
            this.addNextArrivalTimeRound();
            console.log('Round ' + k);
            for(let i = 0; i < targetStops.length; i++){
                console.log(Converter.secondsToTime(this.earliestArrivalTime[targetStops[i]]));
            }
            
            
            this.Q = [];
            while(this.markedStops.length > 0){
                let markedStop = this.markedStops.pop();
                let routesServingStop: RouteStopMapping[] = GoogleTransitData.ROUTESSERVINGSTOPS[markedStop];
                for(let j = 0; j < routesServingStop.length; j++) {
                    let routeId = routesServingStop[j].routeId;
                    let stopSequence = routesServingStop[j].stopSequence;
                    let addRoute = true;
                    for(let k = 0; k < this.Q.length; k++){
                        if(this.Q[k].r === routeId && this.Q[k].stopSequence > stopSequence){
                            this.Q[k].p = markedStop;
                            this.Q[k].stopSequence = stopSequence;
                            addRoute = false;
                            break;
                        }
                    }
                    if(addRoute){
                        this.Q.push({r: routeId, p: markedStop, stopSequence: stopSequence});
                    }
                }
            }
            
    
            
            for(let i= 0; i < this.Q.length; i++){
                let r = this.Q[i].r;
                let p = this.Q[i].p;
                let tripInfo = this.getEarliestTrip(r, p, k);
                let t = tripInfo.tripId;
                //console.log('Route: ' + r)
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
                    //let part1Start = performance.now();
                    let stopTime = GoogleTransitData.getStopTimeByTripAndStop(t, pi);
                    if(!stopTime){
                        continue;
                    }
                    let arrivalTime = stopTime.arrivalTime;
                    if(arrivalTime < tripInfo.tripDeparture){
                        arrivalTime += (24*3600);
                    }
                    //this.timePart1 += (performance.now() - part1Start);
                    if(stopTime){
                        //console.log('Trip: ' + t)
                        //console.log(stopTime.stopSequence)
                        //console.log(stopTime.arrivalTime)
                    }
                    //let part2Start = performance.now();
                    let earliestTargetStopArrival = this.earliestArrivalTime[targetStops[0]];
                    for(let l = 1; l < targetStops.length; l++){
                        if(this.earliestArrivalTime[targetStops[i]] < earliestTargetStopArrival){
                            earliestTargetStopArrival = this.earliestArrivalTime[targetStops[i]];
                        }
                    }
                    if(stopTime && arrivalTime < Math.min(this.earliestArrivalTime[pi], earliestTargetStopArrival)){
                        this.earliestArrivalTimePerRound[k][pi] = arrivalTime;
                        this.earliestArrivalTime[pi] = arrivalTime;
                        this.markedStops.push(pi);
                    }
                    //this.timePart2 += (performance.now() - part2Start);
                    if(stopTime && this.earliestArrivalTimePerRound[k-1][pi] < stopTime.departureTime){
                        let newT = this.getEarliestTrip(r, pi, k);
                        if(newT){
                            tripInfo = newT
                            t = tripInfo.tripId
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
                        this.markedStops.push(pN);
                        if(this.earliestArrivalTimePerRound[k][pN] < this.earliestArrivalTime[pN]){
                            this.earliestArrivalTime[pN] = this.earliestArrivalTimePerRound[k][pN];
                        }
                    }
                }
            }
            

            // console.log('Part 1: ' + this.timePart1)
            // console.log('Part 2: ' + this.timePart2)
            // console.log('Part 3: ' + this.timePart3)
            // console.log('Part et: ' + this.timeEt)

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

        
        //console.log(this.markedStops)
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
        //let part3Start = performance.now();
        let stopTimes: StopTime[] = GoogleTransitData.getStopTimesByStopAndRoute(pi, r);
        //this.timePart3 += (performance.now() - part3Start);
        let earliestDeparture = Number.MAX_VALUE;
        let earliestArrival = this.earliestArrivalTimePerRound[k-1][pi];
        //let etStart = performance.now();
        for(let i = 0; i < stopTimes.length; i++) {
            let stopTime = stopTimes[i];
            if(stopTime.departureTime >= earliestArrival && stopTime.departureTime < earliestDeparture) {
                earliestDeparture = stopTime.departureTime;
                tripId = stopTime.tripId;
            }
        }
        //this.timeEt += (performance.now() - etStart);
        let earliestTripInfo: EarliestTripInfo;
        if(tripId){
            earliestTripInfo= {
                tripId: tripId,
                tripDeparture: GoogleTransitData.STOPTIMES[GoogleTransitData.STOPTIMESOFATRIP[tripId]].arrivalTime,
                dayOffset: 0
            }
        } else {
            earliestTripInfo= {
                tripId: null,
                tripDeparture: null,
                dayOffset: null
            }
        }
        return earliestTripInfo;
    }
}