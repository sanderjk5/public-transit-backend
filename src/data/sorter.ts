import { Connection } from "../models/Connection";
import { StopTime } from "../models/StopTime";

export class Sorter {
    public static sortStopTimesBySequence(a: StopTime, b: StopTime): number{
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
}