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
    /**
     * Add a random delay to each trip.
     */
    public static addDelaysToTrips(){
        for(let trip of GoogleTransitData.TRIPS){
            trip.givenDelay = Reliability.getRandomDelay(trip.isLongDistance)
        }
    }

    /**
     * Use the modified csa algorithm to calculate the earliest arrival time when the delays are known. 
     * @param sourceStop 
     * @param targetStop 
     * @param sourceTime 
     * @param sourceDate 
     * @returns 
     */
    public static getEarliestArrivalTimeCSA(sourceStop: number, targetStop: number, sourceTime: number, sourceDate: Date){
        return ConnectionScanAlgorithmController.getEarliestArrivalTime(sourceStop, targetStop, sourceDate, sourceTime, false, Number.MAX_VALUE, true);
    }

    /**
     * Calculates the arrival time of the decision graph for the knwon delays.
     * @param sourceStop 
     * @param targetStop 
     * @param expectedArrivalTimes 
     * @returns 
     */
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