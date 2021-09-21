import { Connection } from "../models/Connection";
import { StopTime } from "../models/StopTime";
import { Footpath } from "../models/Footpath";
import { GoogleTransitData } from "./google-transit-data";
import { Sorter } from "./sorter";

export class Generator {
    /**
     * Generates all connections using the stop times. Sorts them by departure time.
     */
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

        // sets the ids of the sorted connections.
        for(let i = 0; i < connections.length; i++){
            connections[i].id = i;
        }

        GoogleTransitData.CONNECTIONS = connections;
    }

    /**
     * Generates all footpaths within stops. Sets footpaths between stop entries of the same stop to 2 minutes and footpath within the same stop entry to 0 minutes.
     * Footpaths are reflexive: if a foothpath between stop a and b exits, there is also a footpath between b and a with the same duration.
     */
    public static generateFootpaths(){
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            const stop1 = GoogleTransitData.STOPS[i];
            // change time at every stop
            let footpath: Footpath = {
                id: GoogleTransitData.FOOTPATHS.length,
                departureStop: stop1.id,
                arrivalStop: stop1.id,
                duration: 0
            }
            GoogleTransitData.FOOTPATHS.push(footpath);
            // reflexive footpaths between stop entries of the same stop
            for(let j = i+1; j < GoogleTransitData.STOPS.length; j++) {
                const stop2 = GoogleTransitData.STOPS[j];
                let createStops = false;
                let duration: number;
                if(stop1.name === GoogleTransitData.STOPS[j].name){
                    createStops = true;
                    duration = 120;
                } else {
                    const distance = this.calculateDistance(stop1.lat, stop2.lat, stop1.lon, stop2.lon);
                    if(distance < 0.2){
                        createStops = true;
                        duration = Math.floor(15 * distance) * 60;
                    }
                }
                if(createStops) {
                    let footpath: Footpath = {
                        id: GoogleTransitData.FOOTPATHS.length,
                        departureStop: stop1.id,
                        arrivalStop: stop2.id,
                        duration: duration
                    };
                    GoogleTransitData.FOOTPATHS.push(footpath);
                    footpath = {
                        id: GoogleTransitData.FOOTPATHS.length,
                        departureStop: stop2.id,
                        arrivalStop: stop1.id,
                        duration: duration
                    }
                    GoogleTransitData.FOOTPATHS.push(footpath);
                }
            }
        }

        GoogleTransitData.FOOTPATHS.sort((a: Footpath, b: Footpath) => {
            return Sorter.sortFootpathsByDepartureStop(a, b);
        })

        GoogleTransitData.FOOTPATHSOFASTOP = new Array(GoogleTransitData.STOPS.length);
        let lastDepartureStopId = 0;
        GoogleTransitData.FOOTPATHSOFASTOP[lastDepartureStopId] = 0;

        for(let i = 0; i < GoogleTransitData.FOOTPATHS.length; i++) {
            let departureStop = GoogleTransitData.FOOTPATHS[i].departureStop
            if(lastDepartureStopId !== departureStop){
                GoogleTransitData.FOOTPATHSOFASTOP[departureStop] = i;
            }
            lastDepartureStopId = departureStop;
        }

        while(true) {
            const newFootpaths: Footpath[] = [];

            for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
                const stop = GoogleTransitData.STOPS[i];
                const footPathsOfStop = GoogleTransitData.getAllFootpathsOfAStop(stop.id);
                const arrivalStops = [];
                for(let j = 0; j < footPathsOfStop.length; j++){
                    arrivalStops.push(footPathsOfStop[j].arrivalStop);
                }
                for(let j = 0; j < arrivalStops.length; j++){
                    const arrivalStopId = arrivalStops[j]
                    const footPathsOfArrivalStop = GoogleTransitData.getAllFootpathsOfAStop(arrivalStopId);
                    for(let k = 0; k < footPathsOfArrivalStop.length; k++) {
                        const nextArrivalStop = GoogleTransitData.STOPS[footPathsOfArrivalStop[k].arrivalStop];
                        if(!arrivalStops.includes(nextArrivalStop.id)) {
                            const distance = this.calculateDistance(stop.lat, nextArrivalStop.lat, stop.lon, nextArrivalStop.lon);
                            const duration = Math.floor(15 * distance) * 60;
                            const footpath = {
                                id: GoogleTransitData.FOOTPATHS.length + newFootpaths.length,
                                departureStop: stop.id,
                                arrivalStop: nextArrivalStop.id,
                                duration: duration
                            }
                            newFootpaths.push(footpath);
                        }
                    }
                }
            }
            for(let i = 0; i < newFootpaths.length; i++){
                GoogleTransitData.FOOTPATHS.push(newFootpaths[i])
            }
            
            GoogleTransitData.FOOTPATHS.sort((a: Footpath, b: Footpath) => {
                return Sorter.sortFootpathsByDepartureStop(a, b);
            })
    
            GoogleTransitData.FOOTPATHSOFASTOP = new Array(GoogleTransitData.STOPS.length);
            let lastDepartureStopId = 0;
            GoogleTransitData.FOOTPATHSOFASTOP[lastDepartureStopId] = 0;
    
            for(let i = 0; i < GoogleTransitData.FOOTPATHS.length; i++) {
                let departureStop = GoogleTransitData.FOOTPATHS[i].departureStop
                if(lastDepartureStopId !== departureStop){
                    GoogleTransitData.FOOTPATHSOFASTOP[departureStop] = i;
                }
                lastDepartureStopId = departureStop;
            }

            if(newFootpaths.length === 0){
                break;
            }
        }

        for(let i = 0; i < GoogleTransitData.FOOTPATHS.length; i++){
            GoogleTransitData.FOOTPATHS[i].id = i;
        }
    }

    private static calculateDistance(lat1: number, lat2: number, lon1: number, lon2: number): number {
        const R = 111.319;
        const x = (lon2 - lon1) * Math.cos(0.00872664626*(lat2+lat1));
        const y = lat2 - lat1;
        const d = R * Math.sqrt(x*x + y*y);
        return d;
    }

    /**
     * Uses all stop times to generate routes which satify the following condition of the raptor algorithm: all trips of a route have the same sequence of stops.
     */
    public static generateValidRoutes(): void {
        // copy of imported routes can be used to store the information of each route
        const routesCopy = GoogleTransitData.ROUTES;
        GoogleTransitData.ROUTES = [];
        GoogleTransitData.STOPTIMES.sort((a: StopTime, b: StopTime) => {
            return Sorter.sortStopTimesByTripIdAndSequence(a, b);
        })

        // creates array with pointers to optimize the raptor algorithm
        GoogleTransitData.STOPTIMESOFATRIP = new Array(GoogleTransitData.TRIPS.length);
        GoogleTransitData.TRIPSOFAROUTE = [];
        GoogleTransitData.STOPSOFAROUTE = [];
        GoogleTransitData.ROUTESSERVINGSTOPS = new Array(GoogleTransitData.STOPS.length);
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            GoogleTransitData.ROUTESSERVINGSTOPS[i] = [];
        }

        // id mapping for the new route
        const routeIdMapping = new Map<string, number>();
        let lastTripId = GoogleTransitData.STOPTIMES[0].tripId;
        let stopIdString = '';
        let stops = [];
        GoogleTransitData.STOPTIMESOFATRIP[GoogleTransitData.STOPTIMES[0].tripId] = 0;
        for(let i = 0; i < GoogleTransitData.STOPTIMES.length; i++){
            let stopTime = GoogleTransitData.STOPTIMES[i];
            // checks for each trip of a new generated route has a trip with the same stop sequence
            if(lastTripId !== stopTime.tripId){
                // uses the string of stop ids to identify the stop sequences
                let newRouteId = routeIdMapping.get(stopIdString)
                // creates a new route if no equal stop sequence exists
                if(!newRouteId){
                    let newRoute = routesCopy[GoogleTransitData.TRIPS[lastTripId].routeId];
                    newRouteId = GoogleTransitData.ROUTES.length;
                    newRoute.id = newRouteId;
                    // sets the id mapping of the new route
                    routeIdMapping.set(stopIdString, newRouteId);
                    // adds the new route
                    GoogleTransitData.ROUTES.push(newRoute);
                    GoogleTransitData.STOPSOFAROUTE.push(stops);
                    for(let j = 0; j < stops.length; j++){
                        GoogleTransitData.ROUTESSERVINGSTOPS[stops[j]].push({routeId: newRouteId, stopSequence: j})
                    }
                    GoogleTransitData.TRIPSOFAROUTE.push([lastTripId]);
                } else {
                    GoogleTransitData.TRIPSOFAROUTE[newRouteId].push(lastTripId);
                }
                // sets the route id of the related trip
                GoogleTransitData.TRIPS[lastTripId].routeId = newRouteId;
                stopIdString = '';
                stops = [];
                GoogleTransitData.STOPTIMESOFATRIP[stopTime.tripId] = i;
            }
            // adds the stop id to the stop sequence string
            stopIdString += stopTime.stopId.toString() + ','
            stops.push(stopTime.stopId);
            lastTripId = stopTime.tripId;
        }
    }
}