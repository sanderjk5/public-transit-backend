import { SECONDS_OF_A_DAY } from "../../constants";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";
import { ConnectionScanMeatAlgorithmController } from "./connectionScanMeatAlgorithmController";
import { RaptorAlgorithmController } from "./raptorAlgorithmController";
import { RaptorMeatAlgorithmController } from "./raptorMeatAlgorithmController";

export class TestController {

    /**
     * Creates random requests and compares the results of Raptor and CSA. Calculates the average time of both algorithms.
     */
    public static testAlgorithms() {
        let raptorTimes = 0;
        let numberOfSuccessfulRequestsRaptor = 0;
        let csaTimes = 0;
        let numberOfSuccessfulRequestsCSA = 0;
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
        for(let i = 0; i < 100; i++){
            const randomSourceStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomTargetStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomSourceTime = this.getRandomInt(numberOfSeconds);
            const randomSourceDate = dates[this.getRandomInt(numberOfDates)];
            const raptorResponse = RaptorAlgorithmController.testAlgorithm(randomSourceStop, randomTargetStop, randomSourceDate, randomSourceTime);
            const csaResponse = ConnectionScanAlgorithmController.testAlgorithm(randomSourceStop, randomTargetStop, randomSourceDate, randomSourceTime);
            if(raptorResponse){
                raptorTimes += raptorResponse.duration;
                numberOfSuccessfulRequestsRaptor++;
            }
            if(csaResponse){
                csaTimes += csaResponse.duration;
                numberOfSuccessfulRequestsCSA++;
            }
            if(raptorResponse && csaResponse){
                if(raptorResponse.arrivalTime !== csaResponse.arrivalTime){
                    console.log(randomSourceStop + ', ' + randomTargetStop + ', ' + randomSourceDate + ', ' + Converter.secondsToTime(randomSourceTime));
                }
            } else if (!(!raptorResponse && !csaResponse)){
                console.log(randomSourceStop + ', ' + randomTargetStop + ', ' + randomSourceDate + ', ' + Converter.secondsToTime(randomSourceTime));
            }
        }
        console.log('average raptor: ' + raptorTimes/numberOfSuccessfulRequestsRaptor)
        console.log('average csa: ' + csaTimes/numberOfSuccessfulRequestsCSA)
    }

    /**
     * Creates random requests and compares the results of Raptor and CSA. Calculates the average time of both algorithms.
     */
     public static testMeatAlgorithms() {
        let raptorMeatTimes = 0;
        let numberOfSuccessfulRequestsRaptor = 0;
        let csaMeatTimes = 0;
        let numberOfSuccessfulRequestsCSA = 0;
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
        const failedRequests = [];
        for(let i = 0; i < 100; i++){
            const randomSourceStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomTargetStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomSourceTime = this.getRandomInt(numberOfSeconds);
            const randomSourceDate = dates[this.getRandomInt(numberOfDates)];
            let requestString = randomSourceStop + ', ' + randomTargetStop + ', ' + randomSourceDate + ', ' + Converter.secondsToTime(randomSourceTime);
            console.log('request: ' + requestString)
            const raptorResponse = RaptorMeatAlgorithmController.testRaptorMeatAlgorithm(randomSourceStop, randomTargetStop, Converter.secondsToTime(randomSourceTime), randomSourceDate);
            const csaResponse = ConnectionScanMeatAlgorithmController.testConnectionScanMeatAlgorithm(randomSourceStop, randomTargetStop, Converter.secondsToTime(randomSourceTime), randomSourceDate);
            if(raptorResponse){
                raptorMeatTimes += raptorResponse.duration;
                numberOfSuccessfulRequestsRaptor++;
            }
            if(csaResponse){
                csaMeatTimes += csaResponse.duration;
                numberOfSuccessfulRequestsCSA++;
            }
            if(raptorResponse && csaResponse){
                if(raptorResponse.expectedArrivalTime !== csaResponse.expectedArrivalTime){
                    console.log('result: failed, ' + csaResponse.expectedArrivalTime + ', ' + raptorResponse.expectedArrivalTime);
                    failedRequests.push(requestString)
                } else {
                    console.log('result: successful');
                }
            } else if (!(!raptorResponse && !csaResponse)){
                console.log('result: failed');
                failedRequests.push(requestString)
            } else {
                console.log('result: no solution exists');
            }
        }
        console.log('average raptor meat: ' + raptorMeatTimes/numberOfSuccessfulRequestsRaptor)
        console.log('average csa meat: ' + csaMeatTimes/numberOfSuccessfulRequestsCSA)
        if(failedRequests.length > 0){
            console.log('failed requests:')
            console.log(failedRequests)
        } else {
            console.log('no request failed')
        }
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