import { Stop } from "../models/Stop";
import { CalendarDate } from "../models/CalendarDates";
import { Route } from "../models/Routes";
import { Calendar } from "../models/Calendar";
import { StopTime } from "../models/StopTime";
import { Footpath } from "../models/Footpath";
import { Trip } from "../models/Trip";
import { Agency } from "../models/Agency";
import { Connection } from "../models/Connection";
import { RouteStopMapping } from "../models/RouteStopMapping";


export class GoogleTransitData {
    // Stores data of the imported gtfs files.
    public static AGENCIES: Agency[] = [];
    public static CALENDAR: Calendar[] = [];
    public static CALENDAR_DATES: CalendarDate[] = [];
    public static ROUTES: Route[] = [];
    public static STOPS: Stop[] = [];
    public static STOPTIMES: StopTime[] = [];
    public static FOOTPATHS: Footpath[] = [];
    public static TRIPS: Trip[] = [];
    // connections of connection scan algorithm
    public static CONNECTIONS: Connection[] = [];
    // pointer to optimize the raptor algorithm
    public static ROUTESSERVINGSTOPS: RouteStopMapping[][];
    public static STOPSOFAROUTE: number[][];
    public static STOPTIMESOFATRIP: number[];
    public static TRIPSOFAROUTE: number[][];
    // pointer to get faster all footpaths of a stop
    public static FOOTPATHSOFASTOP: number[];

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
     * Gets all footpaths of a given stop.
     * @param stopID 
     * @returns 
     */
    public static getAllFootpathsOfAStop(stopID: number){
        let footpaths: Footpath[] = [];
        let firstFootpathOfStop = GoogleTransitData.FOOTPATHSOFASTOP[stopID];
        if(firstFootpathOfStop){
            for(let i = firstFootpathOfStop; i < this.FOOTPATHS.length; i++){
                if(this.FOOTPATHS[i].departureStop === stopID){
                    footpaths.push(this.FOOTPATHS[i]);
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
        if(!tripId || !stopId){
            return null;
        }
        let firstStopTimeOfTrip = GoogleTransitData.STOPTIMESOFATRIP[tripId];
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
     * Gets all stop times of a given stop and route.
     * @param stopId 
     * @param r 
     * @returns 
     */
    public static getStopTimesByStopAndRoute(stopId: number, r: number): StopTime[] {
        if(!r || !stopId){
            return [];
        }
        let stopTimes = []
        let tripsOfRoute = GoogleTransitData.TRIPSOFAROUTE[r];
        for(let i = 0; i < tripsOfRoute.length; i++){
            let tripId = tripsOfRoute[i];
            let firstStopTimeOfTrip = GoogleTransitData.STOPTIMESOFATRIP[tripId];
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
}