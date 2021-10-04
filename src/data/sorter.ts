import { Connection } from "../models/Connection";
import { Footpath } from "../models/Footpath";
import { StopTime } from "../models/StopTime";

export class Sorter {
    /**
     * Sorts stop times by their departure.
     * @param a 
     * @param b 
     * @returns 
     */
    public static sortStopTimesByDeparture(a: StopTime, b: StopTime): number{
        if(a.departureTime < b.departureTime){
            return -1;
        }
        if(a.departureTime === b.departureTime){
            return 0;
        }
        if(a.departureTime > b.departureTime){
            return 1;
        }
    }

    /**
     * Sorts stop times by their trip id and sequence.
     * @param a 
     * @param b 
     * @returns 
     */
    public static sortStopTimesByTripIdAndSequence(a: StopTime, b: StopTime){
        if(a.tripId < b.tripId){
            return -1;
        }
        if(a.tripId === b.tripId){
            if(a.stopSequence < b.stopSequence){
                return -1;
            }
            if(a.stopSequence === b.stopSequence){
                return 0;
            }
            if(a.stopSequence > b.stopSequence){
                return 1;
            }
        }
        if(a.tripId > b.tripId){
            return 1;
        }
    }

    /**
     * Sorts connections by their departure time.
     * @param a 
     * @param b 
     * @returns 
     */
    public static sortConnectionsByDepartureTime(a: Connection, b: Connection){
        if(a.departureTime < b.departureTime){
            return -1;
        }
        if(a.departureTime === b.departureTime){
            return 0;
        }
        if(a.departureTime > b.departureTime){
            return 1;
        }
    }

    /**
     * Sorts footpaths by their departure stop.
     * @param a 
     * @param b 
     * @returns 
     */
    public static sortFootpathsByDepartureStop(a: Footpath, b: Footpath){
        if(a.departureStop < b.departureStop) {
            return -1;
        }
        if(a.departureStop === b.departureStop) {
            return 0;
        }
        if(a.departureStop > b.departureStop) {
            return 1;
        }
    }

    /**
     * Sorts footpaths by their arrival stop.
     * @param a 
     * @param b 
     * @returns 
     */
     public static sortFootpathsByArrivalStop(a: Footpath, b: Footpath){
        if(a.arrivalStop < b.arrivalStop) {
            return -1;
        }
        if(a.arrivalStop === b.arrivalStop) {
            return 0;
        }
        if(a.arrivalStop > b.arrivalStop) {
            return 1;
        }
    }
}