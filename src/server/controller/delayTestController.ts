import { GoogleTransitData } from "../../data/google-transit-data";
import { Reliability } from "../../data/reliability";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";

// stores the information about the earliest trip
interface EarliestTripInfo {
    tripId: number,
    tripArrival: number,
    departureTime?: number,
    dayOffset: number,
}

// stores the expexted arrival time information of a stop
interface Label {
    expectedArrivalTime: number,
    departureTime?: number,
    associatedTrip?: EarliestTripInfo,
    enterTripAtStop?: number,
    exitTripAtStop?: number,
    transferRound: number,
    calcReliability?: number,
}

export class DelayTestController {
    public static addDelaysToTrips(){
        for(let trip of GoogleTransitData.TRIPS){
            trip.givenDelay = Reliability.getRandomDelay(trip.isLongDistance)
        }
    }

    public static getEarliestArrivalTimeCSA(sourceStop: number, targetStop: number, sourceTime: number, sourceDate: Date){
        return ConnectionScanAlgorithmController.getEarliestArrivalTime(sourceStop, targetStop, sourceDate, sourceTime, false, Number.MAX_VALUE, true);
    }

    public static getEarliestArrivalTimeRaptorMeat(sourceStop: number, targetStop: number, expectedArrivalTimes: Label[][]){
        let currentLabel = expectedArrivalTimes[sourceStop][0];
        while(currentLabel.exitTripAtStop !== targetStop){
            let nextStop = currentLabel.exitTripAtStop;
            let delay = GoogleTransitData.TRIPS[currentLabel.associatedTrip.tripId].givenDelay;
            let arrivalTime = currentLabel.associatedTrip.tripArrival + delay;
            for(let j = 0; j < expectedArrivalTimes[nextStop].length; j++){
                if(arrivalTime <= expectedArrivalTimes[nextStop][j].departureTime){
                    currentLabel = expectedArrivalTimes[nextStop][j];
                    break;
                }
            }
        }
        let delay = GoogleTransitData.TRIPS[currentLabel.associatedTrip.tripId].givenDelay;
        let arrivalTime = currentLabel.associatedTrip.tripArrival + delay;
        return arrivalTime;
    }
}