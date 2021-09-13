import { Connection } from "../models/Connection";
import { StopTime } from "../models/StopTime";
import { Footpath } from "../models/Footpath";
import { GoogleTransitData } from "./google-transit-data";
import { Sorter } from "./sorter";

export class Generator {
    public static generateSortedConnections() {
        let connections: Connection[] = [];
        let stopTimes: StopTime[] = GoogleTransitData.STOPTIMES;
        stopTimes.sort((a: StopTime, b: StopTime) => {
            return Sorter.sortStopTimesByTripIdAndSequence(a, b);
        });
        
        for(let i = 0; i < stopTimes.length - 1; i++){
            if(stopTimes[i].tripId === stopTimes[i+1].tripId){
                const connection: Connection = {
                    id: i,
                    departureStop: stopTimes[i].stopId,
                    arrivalStop: stopTimes[i+1].stopId,
                    departureTime: stopTimes[i].departureTime,
                    arrivalTime: stopTimes[i+1].arrivalTime,
                    trip: stopTimes[i].tripId
                }
                connections.push(connection);
            }
        }

        connections.sort((a: Connection, b: Connection) => {
            return Sorter.sortConnectionsByDepartureTime(a, b);
        });

        for(let i = 0; i < connections.length; i++){
            connections[i].id = i;
        }

        GoogleTransitData.CONNECTIONS = connections;
    }

    public static generateFootpaths(){
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            let footpath: Footpath = {
                id: GoogleTransitData.FOOTPATHS.length,
                departureStop: GoogleTransitData.STOPS[i].id,
                arrivalStop: GoogleTransitData.STOPS[i].id,
                duration: 0
            }
            GoogleTransitData.FOOTPATHS.push(footpath);
            for(let j = i+1; j < GoogleTransitData.STOPS.length; j++) {
                if(GoogleTransitData.STOPS[i].name === GoogleTransitData.STOPS[j].name){
                    let footpath: Footpath = {
                        id: GoogleTransitData.FOOTPATHS.length,
                        departureStop: GoogleTransitData.STOPS[i].id,
                        arrivalStop: GoogleTransitData.STOPS[j].id,
                        duration: 120
                    };
                    GoogleTransitData.FOOTPATHS.push(footpath);
                    footpath = {
                        id: GoogleTransitData.FOOTPATHS.length,
                        departureStop: GoogleTransitData.STOPS[j].id,
                        arrivalStop: GoogleTransitData.STOPS[i].id,
                        duration: 120
                    }
                    GoogleTransitData.FOOTPATHS.push(footpath);
                }
            }
        }
    }
}