import { SECONDS_OF_A_DAY } from "../../constants";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Reliability } from "../../data/reliability";
import { ConnectionScanMeatAlgorithmController } from "./connectionScanMeatAlgorithmController";
import { RaptorMeatAlgorithmController } from "./raptorMeatAlgorithmController";

export class ApproximationTestController{

    /**
     * Performs the CSA and Raptor MEAT approximation tests for randomly selected requests.
     */
    public static performApproximationTests(){
        const numberOfStops = GoogleTransitData.STOPS.length;
        const numberOfSeconds = SECONDS_OF_A_DAY;
        const numberOfDates = 7;
        const dates = [];
        const initialDate = new Date(Date.now());
        for(let i = 0; i < numberOfDates; i++){
            let newDate = new Date(initialDate);
            newDate.setDate(initialDate.getDate() + i);
            dates.push(newDate);
        }
        let raptorAbsoluteDifference = 0;
        let csaAbsoluteDifference = 0;
        let raptorProportionalDifference = 0;
        let csaProportionalDifference = 0;
        for(let i = 0; i < 1000; i++){
            const randomSourceStop = this.getRandomInt(numberOfStops);
            const randomTargetStop = this.getRandomInt(numberOfStops);
            const randomSourceTime = this.getRandomInt(numberOfSeconds);
            const randomSourceDate = dates[this.getRandomInt(numberOfDates)];
            try {
                let csaResult = this.performApproximationTestForCsaMeatAlgorithm(randomSourceStop, randomTargetStop, randomSourceTime, randomSourceDate, 10000000);
                let raptorResult = this.performApproximationTestForRaptorMeatAlgorithm(randomSourceStop, randomTargetStop, randomSourceTime, randomSourceDate, 10000000);
                csaAbsoluteDifference += Math.abs(csaResult.csaExpectedArrivalTime - csaResult.approximatedExpectedArrivalTime)
                raptorAbsoluteDifference += Math.abs(raptorResult.raptorExpectedArrivalTime - raptorResult.approximatedExpectedArrivalTime)
                csaProportionalDifference += Math.abs((csaResult.csaExpectedArrivalTime - csaResult.approximatedExpectedArrivalTime)/(csaResult.csaExpectedArrivalTime - randomSourceTime));
                raptorProportionalDifference += Math.abs((raptorResult.raptorExpectedArrivalTime - raptorResult.approximatedExpectedArrivalTime)/(raptorResult.raptorExpectedArrivalTime - randomSourceTime));
            } catch {
                i--;
                continue;
            }
        }
        console.log('Average absolute difference csa (in s): ' + csaAbsoluteDifference/1000)
        console.log('Average absolute difference raptor (in s): ' + raptorAbsoluteDifference/1000)
        console.log('Average proportional difference csa (in s): ' + csaProportionalDifference/1000)
        console.log('Average proportional difference raptor (in s): ' + raptorProportionalDifference/1000)
    }

    /**
     * Performs the approximation test for the CSA MEAT algorithm.
     * @param sourceStop 
     * @param targetStop 
     * @param sourceTime 
     * @param sourceDate 
     * @param iterationCounter 
     * @returns 
     */
    private static performApproximationTestForCsaMeatAlgorithm(sourceStop: number, targetStop: number, sourceTime: number, sourceDate: Date, iterationCounter: number){
        const s = ConnectionScanMeatAlgorithmController.getSArray(sourceStop, targetStop, sourceTime, sourceDate);
        if(s === null) {
            throw new Error("Couldn't find a connection.")
        }

        let expectedArrivalTime: number = 0;
        for(let i = 0; i < iterationCounter; i++){
            let currentPair = s[sourceStop][0];
            while(currentPair.exitStop !== targetStop){
                let nextStop = currentPair.exitStop;
                let delay = Reliability.getRandomDelay(GoogleTransitData.TRIPS[currentPair.tripId].isLongDistance);
                let arrivalTime = currentPair.exitTime + delay;
                for(let j = 0; j < s[nextStop].length; j++){
                    if(arrivalTime <= s[nextStop][j].departureTime){
                        currentPair = s[nextStop][j];
                        break;
                    }
                }
            }
            let delay = Reliability.getRandomDelay(GoogleTransitData.TRIPS[currentPair.tripId].isLongDistance);
            let arrivalTime = currentPair.exitTime + delay;
            expectedArrivalTime += arrivalTime;
        }
        return {
            csaExpectedArrivalTime: s[sourceStop][0].expectedArrivalTime,
            approximatedExpectedArrivalTime: expectedArrivalTime/iterationCounter
        };
    }

    /**
     * Performs the approximation test for the Raptor MEAT algorithm.
     * @param sourceStop 
     * @param targetStop 
     * @param sourceTime 
     * @param sourceDate 
     * @param iterationCounter 
     * @returns 
     */
    private static performApproximationTestForRaptorMeatAlgorithm(sourceStop: number, targetStop: number, sourceTime: number, sourceDate: Date, iterationCounter: number){
        const expectedArrivalTimes = RaptorMeatAlgorithmController.getExpectedArrivalTimesArray(sourceStop, targetStop, sourceTime, sourceDate);
        if(expectedArrivalTimes === null) {
            throw new Error("Couldn't find a connection.")
        }

        let expectedArrivalTime: number = 0;
        for(let i = 0; i < iterationCounter; i++){
            let currentLabel = expectedArrivalTimes[sourceStop][0];
            while(currentLabel.exitTripAtStop !== targetStop){
                let nextStop = currentLabel.exitTripAtStop;
                if(currentLabel.associatedTrip === undefined){
                    console.log(currentLabel)
                }
                let delay = Reliability.getRandomDelay(GoogleTransitData.TRIPS[currentLabel.associatedTrip.tripId].isLongDistance);
                let arrivalTime = currentLabel.associatedTrip.tripArrival + delay;
                for(let j = 0; j < expectedArrivalTimes[nextStop].length; j++){
                    if(arrivalTime <= expectedArrivalTimes[nextStop][j].departureTime){
                        currentLabel = expectedArrivalTimes[nextStop][j];
                        break;
                    }
                }
            }
            let delay = Reliability.getRandomDelay(GoogleTransitData.TRIPS[currentLabel.associatedTrip.tripId].isLongDistance);
            let arrivalTime = currentLabel.associatedTrip.tripArrival + delay;
            expectedArrivalTime += arrivalTime;
        }
        return {
            raptorExpectedArrivalTime: expectedArrivalTimes[sourceStop][0].expectedArrivalTime,
            approximatedExpectedArrivalTime: expectedArrivalTime/iterationCounter
        };
    }

    /**
     * Returns a random integer of the interval [0, max).
     * @param max 
     * @returns 
     */
     private static getRandomInt(max: number) {
        return Math.floor(Math.random() * max);
    }
}