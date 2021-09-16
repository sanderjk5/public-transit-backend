import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { RouteStopMapping } from "../../models/RouteStopMapping";
import { StopTime } from "../../models/StopTime";
import { performance } from 'perf_hooks';
import { Sorter } from "../../data/sorter";

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

    private static timePart0;
    private static timePart1;
    private static timePart2;
    private static timePart3;
    private static timePart4;
    private static timePart5;

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
            this.timePart0 = 0;
            this.timePart1 = 0;
            this.timePart2 = 0;
            this.timePart3 = 0;
            this.timePart4 = 0;
            this.timePart5 = 0;
            k++;
            this.addNextArrivalTimeRound();
            console.log('Round ' + k);
            console.log(Converter.secondsToTime(this.earliestArrivalTime[targetStops[0]]));
            
            this.Q = [];
            let qTemp: QEntry[] = [];
            let routeSequenceMinima = new Array(GoogleTransitData.ROUTES.length);
            while(this.markedStops.length > 0){
                // let part0Start = performance.now();
                let markedStop = this.markedStops.pop();
                // this.timePart0 += (performance.now() - part0Start);
                // let part1Start = performance.now();
                let routesServingStop: RouteStopMapping[] = GoogleTransitData.ROUTESSERVINGSTOPS[markedStop];
                // this.timePart1 += (performance.now() - part1Start);
                // let part2Start = performance.now();
                for(let i = 0; i < routesServingStop.length; i++) {
                    let routeId = routesServingStop[i].routeId;
                    let stopSequence = routesServingStop[i].stopSequence;
                    // let part3Start = performance.now();
                    if(!routeSequenceMinima[routeId] || stopSequence < routeSequenceMinima[routeId]){
                        routeSequenceMinima[routeId] = stopSequence;
                    }
                    // this.timePart3 += (performance.now() - part3Start);
                    // let part4Start = performance.now();
                    qTemp.push({r: routeId, p: markedStop, stopSequence: stopSequence});
                    // this.timePart4 += (performance.now() - part4Start);
                }
                // this.timePart2 += (performance.now() - part2Start);
            }
            // let part5Start = performance.now();
            for(let i = 0; i < qTemp.length; i++){
                let qEntry = qTemp[i];
                if(routeSequenceMinima[qEntry.r] === qEntry.stopSequence){
                    this.Q.push(qEntry);
                    routeSequenceMinima[qEntry.r] = - 1;
                }
            }
            // this.timePart5 += (performance.now() - part5Start);

            for(let i= 0; i < this.Q.length; i++){
                let r = this.Q[i].r;
                let p = this.Q[i].p;
                let tripInfo = this.getEarliestTrip(r, p, k);
                let t = tripInfo.tripId;
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
                        if(!this.markedStops.includes(pi)){
                            this.markedStops.push(pi);
                        }
                    }
                    
                    if(stopTime && this.earliestArrivalTimePerRound[k-1][pi] < departureTime){
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
                        if(!this.markedStops.includes(pN)){
                            this.markedStops.push(pN);
                        }
                        if(this.earliestArrivalTimePerRound[k][pN] < this.earliestArrivalTime[pN]){
                            this.earliestArrivalTime[pN] = this.earliestArrivalTimePerRound[k][pN];
                        }
                    }
                }
            }
            
            // console.log('Part 0: ' + this.timePart0)
            // console.log('Part 1: ' + this.timePart1)
            // console.log('Part 2: ' + this.timePart2)
            // console.log('Part 3: ' + this.timePart3)
            // console.log('Part 4: ' + this.timePart4)
            // console.log('Part 5: ' + this.timePart5)

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
}