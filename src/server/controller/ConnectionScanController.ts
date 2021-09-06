import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Searcher } from "../../data/searcher";
import { Stop } from "../../models/Stop";
import { Transfer } from "../../models/Transfer";

interface JourneyPointer {
    enterConnection?: number,
    exitConnection?: number,
    transfer?: number
}

export class ConnectionScanController {
    private static s: number[];
    private static t: number[];
    private static j: JourneyPointer[];

    public static connectionScanAlgorithm(sourceStop: number, targetStop: number, sourceTime: number){
        console.time('connection scan algorithm')
        this.init(sourceStop, sourceTime);
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
                if(this.s[targetStop] <= currentConnectionDepartureTime){
                    break;
                }
                if(this.t[currentConnection.trip] !== null || this.s[currentConnection.departureStop] <= currentConnectionDepartureTime){
                    if(this.t[currentConnection.trip] === null){
                        this.t[currentConnection.trip] = currentConnection.id;
                    }
                    if(currentConnectionArrivalTime < this.s[currentConnection.arrivalStop]){
                        let transfers: Transfer[] = GoogleTransitData.getAllTransfersOfAStop(currentConnection.arrivalStop);
                        for(let i = 0; i < transfers.length; i++){
                            if(currentConnectionArrivalTime + transfers[i].duration < this.s[transfers[i].arrivalStop]){
                                this.s[transfers[i].arrivalStop] = currentConnectionArrivalTime + transfers[i].duration;
                                this.j[transfers[i].arrivalStop] = {
                                    enterConnection: this.t[currentConnection.trip],
                                    exitConnection: currentConnection.id,
                                    transfer: transfers[i].id
                                }
                            }
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
        
        this.getJourney(targetStop);
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
            this.t[i] = null;
        }

        this.j = new Array(GoogleTransitData.STOPS.length);
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            this.j[i] = {
                enterConnection: null,
                exitConnection: null,
                transfer: null
            }
        }

        const transfersOfSourceStop = GoogleTransitData.getAllTransfersOfAStop(sourceStop);
        for(let i = 0; i < transfersOfSourceStop.length; i++){
            this.s[transfersOfSourceStop[i].arrivalStop] = sourceTime + transfersOfSourceStop[i].duration;
        }
    }

    private static getJourney(targetStop: number){
        let transfers: Transfer[] = [];
        let stops: Stop[] = [];

        let currentStop = targetStop;

        while(this.j[currentStop].enterConnection && this.j[currentStop].exitConnection && this.j[currentStop].transfer){
            transfers.push(GoogleTransitData.TRANSFERS[this.j[currentStop].transfer]);
            stops.push(GoogleTransitData.STOPS[GoogleTransitData.CONNECTIONS[this.j[currentStop].exitConnection].arrivalStop]);
            currentStop = GoogleTransitData.CONNECTIONS[this.j[currentStop].enterConnection].departureStop;
        }
        console.log(transfers);
        console.log(stops);
    }
}
