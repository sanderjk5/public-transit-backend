import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Searcher } from "../../data/searcher";

interface SEntry {
    departureTime: number,
    arrivalTime: number,
    lEnter?: number,
    lExit?: number,
}

interface TEntry {
    arrivalTime: number,
    connectionId?: number,
}

export class ProfileConnectionScanAlgorithmController {
    private static s: SEntry[][];
    private static t: TEntry[];
    private static sourceStopPointer: number;
    private static sourceStop: number;
    private static targetStop: number;
    private static minDepartureTime: number;

    public static performAlgorithm(sourceStop: number, targetStop: number, minDepartureTime: number, maxArrivalTime: number) {
        this.sourceStop = sourceStop;
        this.targetStop = targetStop;
        this.minDepartureTime = minDepartureTime;
        let lastConnectionIndex = Searcher.binarySearchOfConnections(maxArrivalTime) - 1;
        let firstConnectionIndex = Searcher.binarySearchOfConnections(minDepartureTime);
        for(let i = lastConnectionIndex; i >= firstConnectionIndex; i--){
            let currentConnection = GoogleTransitData.CONNECTIONS[i];
            let isObserved = false;
            this.updateSourceStopPointer(currentConnection.departureTime);
            
            let time1: number;
            let time2: number;
            let time3: number;
            let timeC: number;
            let p: SEntry;
            let q: SEntry;
            if(currentConnection.arrivalStop === targetStop) {
                time1 = currentConnection.arrivalTime;
            } else {
                time1 = Number.MAX_VALUE;
            }
            time2 = this.t[currentConnection.trip].arrivalTime;
            let j = 0;
            p = this.s[currentConnection.arrivalStop][j];
            while(p.departureTime < currentConnection.arrivalTime) {
                j++;
                p = this.s[currentConnection.arrivalStop][j];
            }
            time3 = p.arrivalTime;
            if(isObserved){
                console.log(time1 + ', ' + time2 + ', ' + time3)
            }
            
            timeC = Math.min(time1, time2, time3);

            p = {
                departureTime: currentConnection.departureTime,
                arrivalTime: timeC,
                lEnter: currentConnection.id,
                lExit: this.t[currentConnection.trip].connectionId,
            }

            if(currentConnection.arrivalStop === this.targetStop && time1 === timeC) {
                p.lExit = currentConnection.id;
            }
            
            if(this.dominates(this.s[sourceStop][this.sourceStopPointer], p)){
                continue;
            }
            q = this.s[currentConnection.departureStop][0];
            
            if(p.lExit !== undefined && p.arrivalTime !== Number.MAX_VALUE && !this.dominates(q, p)) {
                if(q.departureTime !== p.departureTime) {
                    this.s[currentConnection.departureStop].unshift(p)
                } else {
                    this.s[currentConnection.departureStop][0] = p;
                }
            }
            if(timeC !== Number.MAX_VALUE && timeC < this.t[currentConnection.trip].arrivalTime){
                this.t[currentConnection.trip] = {
                    arrivalTime: timeC,
                    connectionId: currentConnection.id,
                };
            }
        }
        console.log(this.s[this.sourceStop])
        console.log(Converter.secondsToTime(this.s[sourceStop][0].arrivalTime))
        this.getJourney();
    }

    public static init(){
        this.s = new Array(GoogleTransitData.STOPS.length);
        this.t = new Array(GoogleTransitData.TRIPS.length);
        this.sourceStopPointer = 0;

        const defaultSEntry: SEntry = {
            departureTime: Number.MAX_VALUE,
            arrivalTime: Number.MAX_VALUE,
        }
        for(let i = 0; i < this.s.length; i++) {
            this.s[i] = [defaultSEntry];
        }
        for(let i = 0; i < this.t.length; i++) {
            this.t[i] = {
                arrivalTime: Number.MAX_VALUE
            };
        }
    }

    private static dominates(q: SEntry, p: SEntry): boolean {
        if(q.arrivalTime < p.arrivalTime) {
            return true;
        }
        if(q.arrivalTime === p.arrivalTime && q.departureTime > p.departureTime) {
            return true;
        }
        return false;
    }


    private static updateSourceStopPointer(currentConnectionDepartureTime: number) {
        if(this.sourceStopPointer > 0) {
            let p = this.s[this.sourceStop][this.sourceStopPointer - 1];
            if(p.departureTime >= currentConnectionDepartureTime) {
                this.sourceStopPointer = this.sourceStopPointer - 1;
            }
        }
    }

    private static getJourney() {
        let s = this.sourceStop;
        let timeS = this.minDepartureTime;
        console.log(timeS)
        while(s !== this.targetStop){
            for(let i = 0; i < this.s[s].length; i++) {
                let p = this.s[s][i];
                if(p.departureTime >= timeS){
                    console.log(GoogleTransitData.STOPS[s].name)
                    console.log(Converter.secondsToTime(p.departureTime))

                    const lExit = GoogleTransitData.CONNECTIONS[p.lExit];
                    s = lExit.arrivalStop;
                    timeS = lExit.arrivalTime;

                    console.log(GoogleTransitData.STOPS[s].name)
                    console.log(Converter.secondsToTime(timeS))
                    break;
                }
            }
            //console.log(GoogleTransitData.STOPS[s].name)
        }
    }
}