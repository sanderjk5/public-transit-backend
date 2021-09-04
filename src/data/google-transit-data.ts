import { Stop } from "../models/Stop";
import { CalendarDate } from "../models/CalendarDates";
import { Route } from "../models/Routes";
import { Calendar } from "../models/Calendar";
import { StopTime } from "../models/StopTime";
import { Transfer } from "../models/Transfer";
import { Trip } from "../models/Trip";
import { Sorter } from "./sorter";
import { Agency } from "../models/Agency";
import { Connection } from "../models/Connection";

export class GoogleTransitData {
    public static AGENCIES: Agency[] = [];
    public static CALENDAR: Calendar[] = [];
    public static CALENDAR_DATES: CalendarDate[] = [];
    public static ROUTES: Route[] = [];
    public static STOPS: Stop[] = [];
    public static STOPTIMES: StopTime[] = [];
    public static TRANSFERS: Transfer[] = [];
    public static TRIPS: Trip[] = [];
    public static CONNECTIONS: Connection[] = [];
    

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

    public static getAllTransfersOfAStop(stopID: number){
        let transfers: Transfer[] = [];
        for(let i = 0; i < this.TRANSFERS.length; i++){
            if(this.TRANSFERS[i].departureStop === stopID){
                transfers.push(this.TRANSFERS[i]);
            }
        }
        return transfers;
    }
}