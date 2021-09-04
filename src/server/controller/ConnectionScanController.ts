import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Searcher } from "../../data/searcher";
import { Transfer } from "../../models/Transfer";

export class ConnectionScanController {
    private static s: number[];
    private static t: number[];

    public static connectionScanAlgorithm(sourceStop: number, targetStop: number, sourceTime: number){
        console.time('connection scan algorithm')
        this.init(sourceStop, sourceTime);
        let firstConnectionId = Searcher.binarySearchOfConnections(sourceTime);
        let dayDifference = 0;
        while(true){
            for(let i = firstConnectionId; i < GoogleTransitData.CONNECTIONS.length; i++){
                let currentConnection = GoogleTransitData.CONNECTIONS[i];
                if(this.s[targetStop] <= currentConnection.departureTime + dayDifference){
                    break;
                }
                if(this.t[currentConnection.trip] > 0 || this.s[currentConnection.departureStop] <= currentConnection.departureTime + dayDifference){
                    this.t[currentConnection.trip]++;
                    if(currentConnection.arrivalTime + dayDifference < this.s[currentConnection.arrivalStop]){
                        let transfers: Transfer[] = GoogleTransitData.getAllTransfersOfAStop(currentConnection.arrivalStop);
                        for(let i = 0; i < transfers.length; i++){
                            this.s[transfers[i].arrivalStop] = Math.min(this.s[transfers[i].arrivalStop], currentConnection.arrivalTime + transfers[i].duration + dayDifference);
                        }
                    }
                }
            }
            if(this.s[targetStop] !== Number.MAX_VALUE){
                break;
            }
            dayDifference += 24 * 3600;
            firstConnectionId = 0;
        }
        
        
        console.timeEnd('connection scan algorithm')
        console.log(this.s[targetStop]);
        console.log(Converter.secondsToTime(this.s[targetStop]));
    }

    private static init(sourceStop: number, sourceTime: number) {
        this.s = new Array(GoogleTransitData.STOPS.length);
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            this.s[i] = Number.MAX_VALUE;
        }

        this.t = new Array(GoogleTransitData.TRIPS.length);
        for(let i = 0; i < GoogleTransitData.TRIPS.length; i++){
            this.t[i] = 0;
        }

        const transfersOfSourceStop = GoogleTransitData.getAllTransfersOfAStop(sourceStop);
        for(let i = 0; i < transfersOfSourceStop.length; i++){
            this.s[transfersOfSourceStop[i].arrivalStop] = sourceTime + transfersOfSourceStop[i].duration;
        }
    }
}
