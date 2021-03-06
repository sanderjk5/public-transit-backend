import { Stop } from "../models/Stop";
import { Route } from "../models/Routes";
import { Calendar } from "../models/Calendar";
import { StopTime } from "../models/StopTime";
import { Footpath } from "../models/Footpath";
import { Trip } from "../models/Trip";
import { Connection } from "../models/Connection";
import { RouteStopMapping } from "../models/RouteStopMapping";

export class GoogleTransitData {
    // Stores data of the imported gtfs files.
    public static CALENDAR: Calendar[] = [];
    public static ROUTES: Route[] = [];
    public static STOPS: Stop[] = [];
    public static STOPTIMES: StopTime[] = [];
    public static FOOTPATHS_SORTED_BY_DEPARTURE_STOP: Footpath[] = [];
    public static FOOTPATHS_SORTED_BY_ARRIVAL_STOP: Footpath[] = [];
    public static TRIPS: Trip[] = [];
    // connections of connection scan algorithm
    public static CONNECTIONS: Connection[] = [];
    // pointer to optimize the raptor algorithm
    public static ROUTES_SERVING_STOPS: RouteStopMapping[][];
    public static STOPS_OF_A_ROUTE: number[][];
    public static STOPTIMES_OF_A_TRIP: number[];
    public static TRIPS_OF_A_ROUTE: number[][];
    // pointer to get faster all footpaths of a stop
    public static FOOTPATHS_OF_A_DEPARTURE_STOP: number[];
    public static FOOTPATHS_OF_A_ARRIVAL_STOP: number[];

    /**
     * Gets all stop ids with a given stop name.
     * @param name 
     * @returns 
     */
    public static getStopIdsByName(name: string): number[]{
        const searchName = name.toLowerCase();
        const stops: number[] = [];
        for(let i = 0; i < this.STOPS.length; i++){
            const stopName = this.STOPS[i].name.toLowerCase();
            if(stopName === searchName){
                stops.push(this.STOPS[i].id)
            }
        }
        return stops;
    }

    /**
     * Gets the stop id of a given stop name.
     * @param name 
     * @returns 
     */
     public static getStopIdByName(name: string): number{
        const searchName = name.toLowerCase();
        for(let i = 0; i < this.STOPS.length; i++){
            const stopName = this.STOPS[i].name.toLowerCase();
            if(stopName === searchName){
                return this.STOPS[i].id;
            }
        }
        return null;
    }

    /**
     * Gets all footpaths of a given stop.
     * @param stopID 
     * @returns 
     */
    public static getAllFootpathsOfADepartureStop(stopID: number){
        let footpaths: Footpath[] = [];
        let firstFootpathOfStop = GoogleTransitData.FOOTPATHS_OF_A_DEPARTURE_STOP[stopID];
        if(firstFootpathOfStop !== undefined){
            for(let i = firstFootpathOfStop; i < this.FOOTPATHS_SORTED_BY_DEPARTURE_STOP.length; i++){
                if(this.FOOTPATHS_SORTED_BY_DEPARTURE_STOP[i].departureStop === stopID){
                    footpaths.push(this.FOOTPATHS_SORTED_BY_DEPARTURE_STOP[i]);
                } else {
                    break;
                }
            }
        }
        return footpaths;
    }

    /**
     * Gets all footpaths of a given stop.
     * @param stopID 
     * @returns 
     */
     public static getAllFootpathsOfAnArrivalStop(stopID: number){
        let footpaths: Footpath[] = [];
        let firstFootpathOfStop = GoogleTransitData.FOOTPATHS_OF_A_ARRIVAL_STOP[stopID];
        if(firstFootpathOfStop !== undefined){
            for(let i = firstFootpathOfStop; i < this.FOOTPATHS_SORTED_BY_ARRIVAL_STOP.length; i++){
                if(this.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[i].arrivalStop === stopID){
                    footpaths.push(this.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[i]);
                } else {
                    break;
                }
            }
        }
        return footpaths;
    }

    /**
     * Gets the stop time of a given stop and trip. Returns null if no valid stop time exists.
     * @param tripId 
     * @param stopId 
     * @returns 
     */
    public static getStopTimeByTripAndStop(tripId: number, stopId: number): StopTime {
        if(tripId === undefined || stopId === undefined){
            return null;
        }
        let firstStopTimeOfTrip = GoogleTransitData.STOPTIMES_OF_A_TRIP[tripId];
        for(let i = firstStopTimeOfTrip; i < GoogleTransitData.STOPTIMES.length; i++) {
            let stopTime = GoogleTransitData.STOPTIMES[i];
            if(stopTime.tripId !== tripId){
                break;
            }
            if(stopTime.tripId === tripId && stopTime.stopId === stopId){
                return stopTime;
            }
        }
        return null;
    }

    /**
     * Gets all stop times of a given trip.
     * @param tripId 
     * @returns 
     */
     public static getStopTimesByTrip(tripId: number): StopTime[] {
        if(tripId === undefined){
            return [];
        }
        let stopTimes = [];
        let firstStopTimeOfTrip = GoogleTransitData.STOPTIMES_OF_A_TRIP[tripId];
        for(let i = firstStopTimeOfTrip; i < GoogleTransitData.STOPTIMES.length; i++) {
            let stopTime = GoogleTransitData.STOPTIMES[i];
            if(stopTime.tripId !== tripId){
                break;
            }
            stopTimes.push(stopTime);
        }
        return stopTimes;
    }

    /**
     * Gets all stop times of a given stop and route.
     * @param stopId 
     * @param r 
     * @returns 
     */
    public static getStopTimesByStopAndRoute(stopId: number, r: number): StopTime[] {
        if(r === undefined || stopId === undefined){
            return [];
        }
        let stopTimes = [];
        let tripsOfRoute = GoogleTransitData.TRIPS_OF_A_ROUTE[r];
        for(let i = 0; i < tripsOfRoute.length; i++){
            let tripId = tripsOfRoute[i];
            let firstStopTimeOfTrip = GoogleTransitData.STOPTIMES_OF_A_TRIP[tripId];
            for(let j = firstStopTimeOfTrip; j < GoogleTransitData.STOPTIMES.length; j++) {
                let stopTime = GoogleTransitData.STOPTIMES[j];
                if(tripId !== stopTime.tripId){
                    break;
                }
                let routeId = GoogleTransitData.TRIPS[stopTime.tripId].routeId;
                if(stopTime.stopId === stopId && routeId === r){
                    stopTimes.push(stopTime);
                }
            }
        }
        return stopTimes;
    }

    /**
     * Checks if a trip is available at a given weekday.
     * @param weekday 
     * @param isAvailable 
     * @returns 
     */
    public static isAvailable(weekday: number, isAvailable: number): boolean{
        if(weekday === 0){
            return (64 & isAvailable) > 0;
        } else if(weekday === 1){
            return (32 & isAvailable) > 0;
        } else if(weekday === 2){
            return (16 & isAvailable) > 0;
        } else if(weekday === 3){
            return (8 & isAvailable) > 0;
        } else if(weekday === 4){
            return (4 & isAvailable) > 0;
        } else if(weekday === 5){
            return (2 & isAvailable) > 0;
        } else if(weekday === 6){
            return (1 & isAvailable) > 0;
        } else {
            return false;
        }
    }
}