import { SECONDS_OF_A_DAY } from "../../constants";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";
import { ConnectionScanEatAlgorithmController } from "./connectionScanEatAlgorithmController";
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
        const failedRequests = [];
        for(let i = 0; i < 1000; i++){
            const randomSourceStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomTargetStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomSourceTime = this.getRandomInt(numberOfSeconds);
            const randomSourceDate = dates[this.getRandomInt(numberOfDates)];
            let requestString = randomSourceStop + ', ' + randomTargetStop + ', ' + randomSourceDate + ', ' + Converter.secondsToTime(randomSourceTime);
            // console.log('request: ' + requestString)
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
                    failedRequests.push(requestString)
                    // console.log('result: failed');
                } else {
                    // console.log('result: successful');
                }
            } else if (!(!raptorResponse && !csaResponse)){
                // console.log('result: failed');
                failedRequests.push(requestString)
            } else {
                // console.log('result: no solution exists');
            }
        }
        console.log('average raptor: ' + raptorTimes/numberOfSuccessfulRequestsRaptor)
        console.log('average csa: ' + csaTimes/numberOfSuccessfulRequestsCSA)
        if(failedRequests.length > 0){
            console.log('failed requests:')
            console.log(failedRequests)
        } else {
            console.log('no request failed')
        }
    }

    /**
     * Creates random requests and compares the results of Raptor Meat and CSA Meat. Calculates the average time of both algorithms.
     */
     public static testMeatAlgorithms() {
        let raptorMeatCompleteTimes = 0;
        let raptorMeatInitTimes = 0;
        let raptorMeatAlgorithmTimes = 0;
        let raptorMeatDecisionGraphTimes = 0;
        let numberOfSuccessfulRequestsRaptor = 0;
        let csaMeatCompleteTimes = 0;
        let csaMeatInitTimes = 0;
        let csaMeatAlgorithmTimes = 0;
        let csaMeatDecisionGraphTimes = 0;
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
        for(let i = 0; i < 1000; i++){
            const randomSourceStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomTargetStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomSourceTime = this.getRandomInt(numberOfSeconds);
            const randomSourceDate = dates[this.getRandomInt(numberOfDates)];
            let requestString = randomSourceStop + ', ' + randomTargetStop + ', ' + randomSourceDate + ', ' + Converter.secondsToTime(randomSourceTime);
            // console.log('request: ' + requestString)
            const raptorResponse = RaptorMeatAlgorithmController.testRaptorMeatAlgorithm(randomSourceStop, randomTargetStop, Converter.secondsToTime(randomSourceTime), randomSourceDate);
            const csaResponse = ConnectionScanMeatAlgorithmController.testConnectionScanMeatAlgorithm(randomSourceStop, randomTargetStop, Converter.secondsToTime(randomSourceTime), randomSourceDate);
            if(raptorResponse){
                raptorMeatCompleteTimes += raptorResponse.completeDuration;
                raptorMeatInitTimes += raptorResponse.initDuration;
                raptorMeatAlgorithmTimes += raptorResponse.algorithmDuration;
                raptorMeatDecisionGraphTimes += raptorResponse.decisionGraphDuration;
                numberOfSuccessfulRequestsRaptor++;
            }
            if(csaResponse){
                csaMeatCompleteTimes += csaResponse.completeDuration;
                csaMeatInitTimes += csaResponse.initDuration;
                csaMeatAlgorithmTimes += csaResponse.algorithmDuration;
                csaMeatDecisionGraphTimes += csaResponse.decisionGraphDuration;
                numberOfSuccessfulRequestsCSA++;
            }
            if(raptorResponse && csaResponse){
                if(raptorResponse.expectedArrivalTime !== csaResponse.expectedArrivalTime){
                    console.log('request: ' + requestString)
                    console.log('result: failed, ' + csaResponse.expectedArrivalTime + ', ' + raptorResponse.expectedArrivalTime);
                    failedRequests.push(requestString)
                } else {
                    // console.log('result: successful');
                }
            } else if (!(!raptorResponse && !csaResponse)){
                // console.log('result: failed');
                failedRequests.push(requestString)
            } else {
                // console.log('result: no solution exists');
            }
        }
        console.log('average raptor meat complete: ' + raptorMeatCompleteTimes/numberOfSuccessfulRequestsRaptor)
        console.log('average raptor meat init: ' + raptorMeatInitTimes/numberOfSuccessfulRequestsRaptor)
        console.log('average raptor meat algorithm: ' + raptorMeatAlgorithmTimes/numberOfSuccessfulRequestsRaptor)
        console.log('average raptor meat decision graph: ' + raptorMeatDecisionGraphTimes/numberOfSuccessfulRequestsRaptor)
        console.log('average csa meat complete: ' + csaMeatCompleteTimes/numberOfSuccessfulRequestsCSA)
        console.log('average csa meat init: ' + csaMeatInitTimes/numberOfSuccessfulRequestsCSA)
        console.log('average csa meat algorithm: ' + csaMeatAlgorithmTimes/numberOfSuccessfulRequestsCSA)
        console.log('average csa meat decision graph: ' + csaMeatDecisionGraphTimes/numberOfSuccessfulRequestsCSA)
        if(failedRequests.length > 0){
            console.log('failed requests:')
            console.log(failedRequests)
        } else {
            console.log('no request failed')
        }
    }

    /**
     * Creates random requests and checks the result of the csa eat algorithm. Calculates the average time of the algorithm.
     */
     public static testEatAlgorithm() {
        let csaEatCompleteTimes = 0;
        let csaEatInitTimes = 0;
        let csaEatAlgorithmTimes = 0;
        let csaEatDecisionGraphTimes = 0;
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
        for(let i = 0; i < 1000; i++){
            const randomSourceStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomTargetStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomSourceTime = this.getRandomInt(numberOfSeconds);
            const randomSourceDate = dates[this.getRandomInt(numberOfDates)];
            let requestString = randomSourceStop + ', ' + randomTargetStop + ', ' + randomSourceDate + ', ' + Converter.secondsToTime(randomSourceTime);
            // console.log('request: ' + requestString)
            const csaResponse = ConnectionScanEatAlgorithmController.testConnectionScanEatAlgorithm(randomSourceStop, randomTargetStop, Converter.secondsToTime(randomSourceTime), randomSourceDate);
            if(csaResponse){
                csaEatCompleteTimes += csaResponse.completeDuration;
                csaEatInitTimes += csaResponse.initDuration;
                csaEatAlgorithmTimes += csaResponse.algorithmDuration;
                csaEatDecisionGraphTimes += csaResponse.decisionGraphDuration;
                numberOfSuccessfulRequestsCSA++;
                if(!csaResponse.result){
                    failedRequests.push(requestString)
                }
            }
        }
        console.log('average csa eat complete: ' + csaEatCompleteTimes/numberOfSuccessfulRequestsCSA)
        console.log('average csa eat init: ' + csaEatInitTimes/numberOfSuccessfulRequestsCSA)
        console.log('average csa eat algorithm: ' + csaEatAlgorithmTimes/numberOfSuccessfulRequestsCSA)
        console.log('average csa eat decision graph: ' + csaEatDecisionGraphTimes/numberOfSuccessfulRequestsCSA)
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