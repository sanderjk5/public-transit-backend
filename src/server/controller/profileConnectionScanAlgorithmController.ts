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
    private static d: number[];
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
            this.updateSourceStopPointer(currentConnection.departureTime);
            let time1: number;
            let time2: number;
            let time3: number;
            let timeC: number;
            let p: SEntry;
            if(this.d[currentConnection.arrivalStop] !== Number.MAX_VALUE) {
                time1 = currentConnection.arrivalTime + this.d[currentConnection.arrivalStop];
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
            
            // if(this.dominates(this.s[sourceStop][this.sourceStopPointer], p)){
            //     continue;
            // }
            
            if(p.lExit !== undefined && p.arrivalTime !== Number.MAX_VALUE && this.notDominatedInProfile(p, currentConnection.departureStop)) {
                let footpaths = GoogleTransitData.getAllFootpathsOfAArrivalStop(currentConnection.departureStop);
                for(let footpath of footpaths) {
                    let pNew: SEntry= {
                        departureTime: currentConnection.departureTime - footpath.duration,
                        arrivalTime: p.arrivalTime,
                        lEnter: p.lEnter,
                        lExit: p.lExit
                    }
                    if(this.notDominatedInProfile(pNew, footpath.departureStop)){
                        
                        let shiftedPairs = [];
                        let currentPair = this.s[footpath.departureStop][0];
                        while(pNew.departureTime >= currentPair.departureTime){
                            let removedPair = this.s[footpath.departureStop].shift()
                            shiftedPairs.push(removedPair);
                            currentPair = this.s[footpath.departureStop][0];
                        }
                        this.s[footpath.departureStop].unshift(pNew);
                        for(let j = 0; j < shiftedPairs.length; j++) {
                            let removedPair = shiftedPairs[j];
                            if(!this.dominates(pNew, removedPair)){
                                this.s[footpath.departureStop].unshift(removedPair);
                            }
                        }
                    }
                    
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
        console.log(this.s[sourceStop][0].arrivalTime)
        this.getJourney();
    }

    public static init(targetStop: number){
        this.s = new Array(GoogleTransitData.STOPS.length);
        this.t = new Array(GoogleTransitData.TRIPS.length);
        this.d = new Array(GoogleTransitData.STOPS.length);
        this.sourceStopPointer = 0;

        const defaultSEntry: SEntry = {
            departureTime: Number.MAX_VALUE,
            arrivalTime: Number.MAX_VALUE,
        }
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++) {
            this.s[i] = [defaultSEntry];
            this.d[i] = Number.MAX_VALUE;
        }
        for(let i = 0; i < this.t.length; i++) {
            this.t[i] = {
                arrivalTime: Number.MAX_VALUE
            };
        }
        
        let finalFootpaths = GoogleTransitData.getAllFootpathsOfAArrivalStop(targetStop);
        for(let footpath of finalFootpaths){
            this.d[footpath.departureStop] = footpath.duration;
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

    private static notDominatedInProfile(p: SEntry, stopId: number): boolean{
        for(let q of this.s[stopId]){
            if(this.dominates(q, p)){
                return false;
            }
        }
        return true;
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
        while(s !== this.targetStop){
            console.log(GoogleTransitData.STOPS[s].name)
            console.log(timeS)
            let minArrivalTime = Number.MAX_VALUE;
            let nextS: number;
            let nextTimeS: number;
            for(let i = 0; i < this.s[s].length; i++) {
                let p = this.s[s][i];
                if(p.arrivalTime === 54540){
                    console.log(p)
                }
                if(p.departureTime >= timeS && p.arrivalTime < minArrivalTime){
                    // if(GoogleTransitData.STOPS[s].name === 'Hamburg Hbf' && p.lExit === 352988){
                    //     continue;
                    // }
                    console.log(Converter.secondsToTime(this.s[s][i].arrivalTime))
                    console.log(this.s[s][i].arrivalTime)
                    const lExit = GoogleTransitData.CONNECTIONS[p.lExit];
                    nextS = lExit.arrivalStop;
                    nextTimeS = lExit.arrivalTime;
                    minArrivalTime = p.arrivalTime;
                    //break;
                }
            }
            s = nextS;
            timeS = nextTimeS;
            console.log(minArrivalTime)
            console.log(GoogleTransitData.STOPS[s].name)
            console.log(Converter.secondsToTime(timeS))
            //console.log(GoogleTransitData.STOPS[s].name)
        }
    }
}