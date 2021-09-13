import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { RouteStopMapping } from "../../models/RouteStopMapping";
import { StopTime } from "../../models/StopTime";

interface QEntry {
    r: number,
    p: number,
    stopSequence: number
}

export class RaptorAlgorithmController {
    private static earliestArrivalTimePerRound: number[][] = [];
    private static earliestArrivalTime: number[];
    private static markedStops: boolean[];
    private static Q: QEntry[];

    public static raptorAlgorithm(sourceStop: number, targetStop: number, sourceTime: string){
        const sourceTimeInSeconds = Converter.timeToSeconds(sourceTime);
        this.init(sourceStop, sourceTimeInSeconds);
        this.performAlgorithm(sourceStop, targetStop, sourceTimeInSeconds);
        console.log(Converter.secondsToTime(this.earliestArrivalTime[targetStop]));
    }

    private static performAlgorithm(sourceStop: number, targetStop: number, sourceTime: number){
        let k = 0;
        while(true){
            k++;
            this.addNextArrivalTimeRound();
            console.log('Round ' + k);
            if(this.earliestArrivalTime[targetStop] < Number.MAX_VALUE){
                console.log(this.earliestArrivalTime[targetStop]);
            }
            
            this.Q = new Array(GoogleTransitData.ROUTES.length);
            for(let i = 0; i < this.markedStops.length; i++){
                if(this.markedStops[i]){
                    console.log('Marked stop:' + i)
                    let routesServingStop: RouteStopMapping[] = GoogleTransitData.ROUTESSERVINGSTOPS[i];
                    for(let j = 0; j < routesServingStop.length; j++) {
                        let routeId = routesServingStop[j].routeId;
                        let stopSequence = routesServingStop[j].stopSequence
                        if(!this.Q[routeId] || this.Q[routeId].stopSequence > stopSequence){
                            this.Q[routeId] = {
                                r:  routeId,
                                p: i,
                                stopSequence: stopSequence
                            }
                        }
                    }
                    this.markedStops[i] = false;
                }
            }
    
            for(let i= 0; i < this.Q.length; i++){
                if(this.Q[i]){
                    let r = this.Q[i].r;
                    let p = this.Q[i].p;
                    let t = this.getEarliestTrip(r, p, k);
                    console.log('Route: ' + r)
                    let reachedP = false;
                    for(let j = 0; j < GoogleTransitData.STOPSOFAROUTE[r].length; j++){
                        let pi = GoogleTransitData.STOPSOFAROUTE[r][j];
                        if(pi === p){
                            reachedP = true;
                        }
                        if(!reachedP){
                            continue;
                        }
                        
                        let stopTime = GoogleTransitData.getStopTimeByTripAndStop(t, pi);
                        if(stopTime){
                            console.log('Trip: ' + t)
                            console.log(stopTime.stopSequence)
                            console.log(stopTime.arrivalTime)
                        }
                        
                        if(stopTime && stopTime.arrivalTime < Math.min(this.earliestArrivalTime[pi], this.earliestArrivalTime[targetStop])){
                            if(stopTime.arrivalTime < 43200){
                                
                            }
                            this.earliestArrivalTimePerRound[k][pi] = stopTime.arrivalTime;
                            this.earliestArrivalTime[pi] = stopTime.arrivalTime;
                            this.markedStops[pi] = true;
                        }
                        if(stopTime && this.earliestArrivalTimePerRound[k-1][pi] < stopTime.departureTime){
                            let newT = this.getEarliestTrip(r, pi, k);
                            if(newT){
                                t = newT
                            }
                        }
                    }
                }
            }
            let areStopsMarked = false;
            for(let i = 0; i < this.markedStops.length; i++){
                if(this.markedStops[i]) {
                    areStopsMarked = true;
                    let footPaths = GoogleTransitData.getAllFootpathsOfAStop(i);
                    for(let j = 0; j < footPaths.length; j++){
                        let p = footPaths[j].departureStop;
                        let pN = footPaths[j].arrivalStop;
                        if(p !== pN){
                            this.earliestArrivalTimePerRound[k][pN] = Math.min(this.earliestArrivalTimePerRound[k][pN], this.earliestArrivalTimePerRound[k][p] + footPaths[j].duration)
                            this.markedStops[pN] = true;
                        }
                        
                    }
                }
            }

            if(!areStopsMarked){
                break;
            }
        }

    }

    private static init(sourceStop: number, sourceTime: number){
        const numberOfStops = GoogleTransitData.STOPS.length;
        const firstRoundTimes = new Array(numberOfStops);
        this.earliestArrivalTime = new Array(numberOfStops);
        this.markedStops = new Array(numberOfStops);

        for(let i = 0; i < numberOfStops; i++){
            firstRoundTimes[i] = Number.MAX_VALUE;
            this.earliestArrivalTime[i] = Number.MAX_VALUE;
            this.markedStops[i] = false;
        }

        firstRoundTimes[sourceStop] = sourceTime;
        this.earliestArrivalTime[sourceStop] = sourceTime;
        this.markedStops[sourceStop] = true;

        this.earliestArrivalTimePerRound.push(firstRoundTimes);
    }

    private static addNextArrivalTimeRound() {
        const numberOfStops = GoogleTransitData.STOPS.length;
        const nextRoundTimes = new Array(numberOfStops)
        for(let i = 0; i < numberOfStops; i++){
            nextRoundTimes[i] = Number.MAX_VALUE;
        }
        this.earliestArrivalTimePerRound.push(nextRoundTimes);
    }

    private static getEarliestTrip(r: number, pi: number, k: number): number {
        let tripId: number; 
        let stopTimes: StopTime[] = GoogleTransitData.getStopTimesByStopAndRoute(pi, r);
        let earliestDeparture = Number.MAX_VALUE;
        let earliestArrival = this.earliestArrivalTimePerRound[k-1][pi];
        for(let i = 0; i < stopTimes.length; i++) {
            let stopTime = stopTimes[i];
            if(stopTime.departureTime >= earliestArrival && stopTime.departureTime < earliestDeparture) {
                earliestDeparture = stopTime.departureTime;
                tripId = stopTime.tripId;
            }
        }
        if(earliestDeparture < Number.MAX_VALUE){
            //console.log(Converter.secondsToTime(earliestDeparture))
        }
        
        return tripId;
    }
}