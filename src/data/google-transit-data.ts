import { Stop } from "../models/Stop";
import { CalendarDate } from "../models/CalendarDates";
import { Route } from "../models/Routes";
import { Calendar } from "../models/Calendar";
import { StopTime } from "../models/StopTime";
import { Footpath } from "../models/Footpath";
import { Trip } from "../models/Trip";
import { Sorter } from "./sorter";
import { Agency } from "../models/Agency";
import { Connection } from "../models/Connection";
import { RouteStopMapping } from "../models/RouteStopMapping";


export class GoogleTransitData {
    public static AGENCIES: Agency[] = [];
    public static CALENDAR: Calendar[] = [];
    public static CALENDAR_DATES: CalendarDate[] = [];
    public static ROUTES: Route[] = [];
    public static STOPS: Stop[] = [];
    public static STOPTIMES: StopTime[] = [];
    public static FOOTPATHS: Footpath[] = [];
    public static TRIPS: Trip[] = [];
    public static CONNECTIONS: Connection[] = [];
    public static ROUTESSERVINGSTOPS: RouteStopMapping[][];
    public static STOPSOFAROUTE: number[][];
    public static STOPTIMESOFATRIP: number[];
    public static TRIPSOFAROUTE: number[][];
    

    public static getRouteByID(routeID: number): Route{
        let route: Route;
        for(let i = 0; i < this.ROUTES.length; i++){
            if(this.ROUTES[i].id === routeID){
                route = this.ROUTES[i];
                break;
            }
        }
        return route;
    }

    public static getStopByID(stopID: number): Stop{
        let stop: Stop;
        for(let i = 0; i < this.STOPS.length; i++){
            if(this.STOPS[i].id === stopID){
                stop = this.STOPS[i];
                break;
            }
        }
        return stop;
    }

    public static getStopIdsByName(name: string): number[]{
        let stops: number[] = [];
        for(let i = 0; i < this.STOPS.length; i++){
            if(this.STOPS[i].name === name){
                stops.push(this.STOPS[i].id)
            }
        }
        return stops;
    }

    public static getFirstTripOfARoute(routeId: number){
        for(let i = 0; i < this.TRIPS.length; i++){
            if(this.TRIPS[i].routeId === routeId){
                return this.TRIPS[i].id
            }
        }
        return null;
    }

    public static getTripsOfARoute(routeId: number){
        let trips: number[] = [];
        for(let i = 0; i < this.TRIPS.length; i++){
            if(this.TRIPS[i].routeId === routeId){
                trips.push(this.TRIPS[i].id)
            }
        }
        return trips;
    }

    public static getTripByID(tripID: number): Trip{
        let trip: Trip;
        for(let i = 0; i < this.TRIPS.length; i++){
            if(this.TRIPS[i].id === tripID){
                trip = this.TRIPS[i];
                break;
            }
        }
        return trip;
    }

    public static getAllTripsOfARouteSortedByDeparture(routeID: number){
        let trips: Trip[] = [];
        for(let i = 0; i < this.TRIPS.length; i++){
            if(this.TRIPS[i].routeId === routeID){
                trips.push(this.TRIPS[i]);
            }
        }
        trips.sort((a: Trip, b: Trip) => {
            return Sorter.sortStopTimesByDeparture(this.getFirstStopTimeOfATrip(a.id), this.getFirstStopTimeOfATrip(b.id))
        })
        return trips;
    }

    public static getFirstStopTimeOfATrip(tripID: number): StopTime{
        return this.getAllStopTimesOfATripSortedBySequence(tripID)[0];
    }

    public static getAllStopTimesOfATripSortedBySequence(tripID: number){
        let stopTimes: StopTime[] = [];
        for(let i = 0; i < this.STOPTIMES.length; i++){
            if(this.STOPTIMES[i].tripId === tripID){
                stopTimes.push(this.STOPTIMES[i]);
            }
        }
        stopTimes.sort((a: StopTime, b: StopTime) => {
            return Sorter.sortStopTimesBySequence(a, b);
        });
        return stopTimes;
    }

    public static getAllFootpathsOfAStop(stopID: number){
        let footpaths: Footpath[] = [];
        for(let i = 0; i < this.FOOTPATHS.length; i++){
            if(this.FOOTPATHS[i].departureStop === stopID){
                footpaths.push(this.FOOTPATHS[i]);
            }
        }
        return footpaths;
    }

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