import { SECONDS_OF_A_DAY } from "../../constants";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { ApproximationTestController } from "./approximationTestController";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";
import { ConnectionScanEatAlgorithmController } from "./connectionScanEatAlgorithmController";
import { ConnectionScanMeatAlgorithmController } from "./connectionScanMeatAlgorithmController";
import { DelayTestController } from "./delayTestController";
import { RaptorAlgorithmController } from "./raptorAlgorithmController";
import { RaptorMeatAlgorithmController } from "./raptorMeatAlgorithmController";

interface RequestInfo{
    sourceStop: number,
    targetStop: number,
    sourceTime: number,
    sourceDate: Date,
}

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
        const dates: Date[] = [];
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
     public static testMeatAlgorithms(alpha: number) {
        let raptorMeatCompleteTimes = 0;
        let raptorMeatInitTimes = 0;
        let raptorMeatAlgorithmTimes = 0;
        let raptorMeatInitLoopTimes = 0;
        let raptorMeatTraverseRoutesLoopTimes = 0;
        let raptorMeatUpdateExpectedArrivalTimesLoopTimes = 0;
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
            const raptorResponse = RaptorMeatAlgorithmController.testRaptorMeatAlgorithm(randomSourceStop, randomTargetStop, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
            const csaResponse = ConnectionScanMeatAlgorithmController.testConnectionScanMeatAlgorithm(randomSourceStop, randomTargetStop, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
            if(raptorResponse){
                raptorMeatCompleteTimes += raptorResponse.completeDuration;
                raptorMeatInitTimes += raptorResponse.initDuration;
                raptorMeatAlgorithmTimes += raptorResponse.algorithmDuration;
                raptorMeatInitLoopTimes += raptorResponse.initLoopDuration,
                raptorMeatTraverseRoutesLoopTimes += raptorResponse.traverseRoutesLoopDuration,
                raptorMeatUpdateExpectedArrivalTimesLoopTimes += raptorResponse.updateExpectedArrivalTimesLoopDuration,
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
        console.log('average raptor meat init loop of algorithm: ' + raptorMeatInitLoopTimes/numberOfSuccessfulRequestsRaptor)
        console.log('average raptor meat traverse routes loop of algorithm: ' + raptorMeatTraverseRoutesLoopTimes/numberOfSuccessfulRequestsRaptor)
        console.log('average raptor meat update expected arrival times loop of algorithm: ' + raptorMeatUpdateExpectedArrivalTimesLoopTimes/numberOfSuccessfulRequestsRaptor)
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
     * Creates random requests and compares the results of Raptor Meat and CSA Meat. Calculates the average time of both algorithms.
     */
     public static performAllTests() {
        let requests: RequestInfo[] = [];
        let alpha1ExpectedArrivalTimes: number[] = [];
        let alpha2ExpectedArrivalTimes: number[] = [];

        DelayTestController.addDelaysToTrips();

        for(let alpha = 1; alpha < 4; alpha++){
            console.log('Alpha = ' + alpha + ':')
            let numberOfSuccessfulRequests = 0;

            let raptorMeatCompleteTimes = 0;
            let raptorMeatInitTimes = 0;
            let raptorMeatAlgorithmTimes = 0;
            let raptorMeatInitLoopTimes = 0;
            let raptorMeatTraverseRoutesLoopTimes = 0;
            let raptorMeatUpdateExpectedArrivalTimesLoopTimes = 0;
            let raptorMeatDecisionGraphTimes = 0;
            let raptorMeatComputedRounds = 0;
            let raptorMeatTransfersOfResult = 0;
            let raptorMeatNumberOfStopsInGraph = 0;
            let raptorMeatNumberOfLegsInGraph = 0;
            let raptorMeatNumberOfEdgesInGraph = 0;
    
            let csaMeatCompleteTimes = 0;
            let csaMeatInitTimes = 0;
            let csaMeatAlgorithmTimes = 0;
            let csaMeatDecisionGraphTimes = 0;
    
            let csaEatCompleteTimes = 0;
            let csaEatInitTimes = 0;
            let csaEatAlgorithmTimes = 0;
            let csaEatDecisionGraphTimes = 0;
    
            let absoluteDifference = 0;
            let proportionalDifference = 0;
            let numberOfExpAtGraphsWithoutBackup = 0;
    
            let raptorAbsoluteDifference = 0;
            let csaAbsoluteDifference = 0;
            let raptorProportionalDifference = 0;
            let csaProportionalDifference = 0;

            let alpha1Alpha2AbsoluteDifference = 0;
            let alpha1Alpha3AbsoluteDifference = 0;
            let alpha2Alpha3AbsoluteDifference = 0;
            let alpha1Alpha2ProportionalDifference = 0;
            let alpha1Alpha3ProportionalDifference = 0;
            let alpha2Alpha3ProportionalDifference = 0;

            let knownDelaysAbsoluteDifference = 0;
            let knownDelaysProportionalDifference = 0;
    
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
    
            let randomSourceStop: number;
            let randomSourceStopName: string;
            let randomTargetStop: number;
            let randomTargetStopName: string;
            let randomSourceTime: number;
            let randomSourceDate: Date;
            for(let i = 0; i < 1000; i++){
                if(alpha === 1){
                    randomSourceStop = this.getRandomInt(numberOfStops);
                    randomTargetStop = this.getRandomInt(numberOfStops);
                    randomSourceTime = this.getRandomInt(numberOfSeconds);
                    randomSourceDate = dates[this.getRandomInt(numberOfDates)];
                } else {
                    randomSourceStop = requests[i].sourceStop;
                    randomTargetStop = requests[i].targetStop;
                    randomSourceTime = requests[i].sourceTime;
                    randomSourceDate = requests[i].sourceDate;
                }
                randomSourceStopName = GoogleTransitData.STOPS[randomSourceStop].name;
                randomTargetStopName = GoogleTransitData.STOPS[randomTargetStop].name;
                
                let raptorMeatResponse;
                let csaMeatResponse;
                let csaExpAtResponse;
                try{
                    raptorMeatResponse = RaptorMeatAlgorithmController.testRaptorMeatAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
                    csaMeatResponse = ConnectionScanMeatAlgorithmController.testConnectionScanMeatAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
                    csaExpAtResponse = ConnectionScanEatAlgorithmController.testConnectionScanEatAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
                } catch(error){
                    if(alpha === 1){
                        i--;
                    }
                    continue;
                }
                if(!raptorMeatResponse || !csaMeatResponse || !csaExpAtResponse){
                    if(alpha === 1){
                        i--;
                    }
                    continue;
                } else {
                    let approximatedResultCSA;
                    let approximatedResultRaptor;
                    let knownDelayResultCSA;
                    let knownDelayResultRaptorMEAT;
                    try{
                        approximatedResultCSA = ApproximationTestController.performApproximationTestForCsaMeatAlgorithmWithGivenSArray(randomSourceStop, randomTargetStop, csaMeatResponse.sArrary, 10000000);
                        approximatedResultRaptor = ApproximationTestController.performApproximationTestForRaptorMeatAlgorithmWithGivenExpectedArrivalTimes(randomSourceStop, randomTargetStop, raptorMeatResponse.expectedArrivalTimes, 10000000);
                        knownDelayResultCSA = DelayTestController.getEarliestArrivalTimeCSA(randomSourceStop, randomTargetStop, randomSourceTime, randomSourceDate);
                        knownDelayResultRaptorMEAT = DelayTestController.getEarliestArrivalTimeRaptorMeat(randomSourceStop, randomTargetStop, raptorMeatResponse.expectedArrivalTimes);
                    } catch(error){
                        if(alpha === 1){
                            i--;
                        }
                        continue;
                    }
                    if(alpha === 1){
                        const request: RequestInfo = {
                            sourceStop: randomSourceStop,
                            targetStop: randomTargetStop,
                            sourceTime: randomSourceTime,
                            sourceDate: randomSourceDate,
                        }
                        requests.push(request);    
                        alpha1ExpectedArrivalTimes.push(raptorMeatResponse.expectedArrivalTime)
                    } else if(alpha === 2){
                        alpha2ExpectedArrivalTimes.push(raptorMeatResponse.expectedArrivalTime)
                    }
                    
                    numberOfSuccessfulRequests++;
    
                    raptorMeatCompleteTimes += raptorMeatResponse.completeDuration;
                    raptorMeatInitTimes += raptorMeatResponse.initDuration;
                    raptorMeatAlgorithmTimes += raptorMeatResponse.algorithmDuration;
                    raptorMeatInitLoopTimes += raptorMeatResponse.initLoopDuration,
                    raptorMeatTraverseRoutesLoopTimes += raptorMeatResponse.traverseRoutesLoopDuration,
                    raptorMeatUpdateExpectedArrivalTimesLoopTimes += raptorMeatResponse.updateExpectedArrivalTimesLoopDuration,
                    raptorMeatDecisionGraphTimes += raptorMeatResponse.decisionGraphDuration;
                    raptorMeatComputedRounds += raptorMeatResponse.computedRounds;
                    raptorMeatTransfersOfResult += raptorMeatResponse.transferCountOfResult;
                    raptorMeatNumberOfStopsInGraph += raptorMeatResponse.numberOfStops;
                    raptorMeatNumberOfLegsInGraph += raptorMeatResponse.numberOfLegs;
                    raptorMeatNumberOfEdgesInGraph += raptorMeatResponse.numberOfEdgesInCompactGraph;

                    if(alpha === 2){
                        alpha1Alpha2AbsoluteDifference += Math.abs(alpha1ExpectedArrivalTimes[i] - raptorMeatResponse.expectedArrivalTime);
                        alpha1Alpha2ProportionalDifference += Math.abs((alpha1ExpectedArrivalTimes[i] - raptorMeatResponse.expectedArrivalTime)/(raptorMeatResponse.earliestArrivalTime - randomSourceTime))

                    } else if(alpha === 3){
                        alpha1Alpha3AbsoluteDifference += Math.abs(alpha1ExpectedArrivalTimes[i] - raptorMeatResponse.expectedArrivalTime);
                        alpha1Alpha3ProportionalDifference += Math.abs((alpha1ExpectedArrivalTimes[i] - raptorMeatResponse.expectedArrivalTime)/(raptorMeatResponse.earliestArrivalTime - randomSourceTime))
                        alpha2Alpha3AbsoluteDifference += Math.abs(alpha2ExpectedArrivalTimes[i] - raptorMeatResponse.expectedArrivalTime);
                        alpha2Alpha3ProportionalDifference += Math.abs((alpha2ExpectedArrivalTimes[i] - raptorMeatResponse.expectedArrivalTime)/(raptorMeatResponse.earliestArrivalTime - randomSourceTime))
                    }
    
                    csaMeatCompleteTimes += csaMeatResponse.completeDuration;
                    csaMeatInitTimes += csaMeatResponse.initDuration;
                    csaMeatAlgorithmTimes += csaMeatResponse.algorithmDuration;
                    csaMeatDecisionGraphTimes += csaMeatResponse.decisionGraphDuration;
    
                    csaEatCompleteTimes += csaExpAtResponse.completeDuration;
                    csaEatInitTimes += csaExpAtResponse.initDuration;
                    csaEatAlgorithmTimes += csaExpAtResponse.algorithmDuration;
                    csaEatDecisionGraphTimes += csaExpAtResponse.decisionGraphDuration;
    
                    if(csaExpAtResponse.expectedArrivalTime < 3 * SECONDS_OF_A_DAY){
                        absoluteDifference += csaExpAtResponse.expectedArrivalTime - raptorMeatResponse.expectedArrivalTime;
                        proportionalDifference += (csaExpAtResponse.expectedArrivalTime - raptorMeatResponse.expectedArrivalTime)/(raptorMeatResponse.earliestArrivalTime - randomSourceTime);
                    } else {
                        numberOfExpAtGraphsWithoutBackup++;
                    }
    
                    
                    csaAbsoluteDifference += Math.abs(csaMeatResponse.expectedArrivalTime - approximatedResultCSA);
                    raptorAbsoluteDifference += Math.abs(raptorMeatResponse.expectedArrivalTime - approximatedResultRaptor);
                    csaProportionalDifference += Math.abs((csaMeatResponse.expectedArrivalTime - approximatedResultCSA)/(raptorMeatResponse.earliestArrivalTime - randomSourceTime));
                    raptorProportionalDifference += Math.abs((raptorMeatResponse.expectedArrivalTime - approximatedResultRaptor)/(raptorMeatResponse.earliestArrivalTime - randomSourceTime));
                
                    knownDelaysAbsoluteDifference += (knownDelayResultRaptorMEAT - knownDelayResultCSA);
                    knownDelaysProportionalDifference += (knownDelayResultRaptorMEAT - knownDelayResultCSA)/(raptorMeatResponse.earliestArrivalTime - randomSourceTime);
                }
            }
            console.log('Raptor MEAT Results:')
            console.log('Times:')
            console.log('average raptor meat complete: ' + raptorMeatCompleteTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat init: ' + raptorMeatInitTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat algorithm: ' + raptorMeatAlgorithmTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat init loop of algorithm: ' + raptorMeatInitLoopTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat traverse routes loop of algorithm: ' + raptorMeatTraverseRoutesLoopTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat update expected arrival times loop of algorithm: ' + raptorMeatUpdateExpectedArrivalTimesLoopTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat decision graph: ' + raptorMeatDecisionGraphTimes/numberOfSuccessfulRequests)
            console.log('Additional infos:')
            console.log('average raptor meat computed rounds: ' + raptorMeatComputedRounds/numberOfSuccessfulRequests)
            console.log('average raptor meat transfers of result: ' + raptorMeatTransfersOfResult/numberOfSuccessfulRequests)
            console.log('average raptor meat number of stops in graph: ' + raptorMeatNumberOfStopsInGraph/numberOfSuccessfulRequests)
            console.log('average raptor meat number of legs in graph: ' + raptorMeatNumberOfLegsInGraph/numberOfSuccessfulRequests)
            console.log('average raptor meat number of edges in compact graph: ' + raptorMeatNumberOfEdgesInGraph/numberOfSuccessfulRequests)
            if(alpha === 2){
                console.log('Different alpha value Results:')
                console.log('average alpha = 1 vs. alpha = 2 absolute difference: ' + alpha1Alpha2AbsoluteDifference/numberOfSuccessfulRequests)
                console.log('average alpha = 1 vs. alpha = 2 proportional difference: ' + alpha1Alpha2ProportionalDifference/numberOfSuccessfulRequests)
            } else if(alpha === 3){
                console.log('Different alpha value Results:')
                console.log('average alpha = 1 vs. alpha = 3 absolute difference: ' + alpha1Alpha3AbsoluteDifference/numberOfSuccessfulRequests)
                console.log('average alpha = 1 vs. alpha = 3 proportional difference: ' + alpha1Alpha3ProportionalDifference/numberOfSuccessfulRequests)
                console.log('average alpha = 2 vs. alpha = 3 absolute difference: ' + alpha2Alpha3AbsoluteDifference/numberOfSuccessfulRequests)
                console.log('average alpha = 2 vs. alpha = 3 proportional difference: ' + alpha2Alpha3ProportionalDifference/numberOfSuccessfulRequests)
            }
            console.log('CSA MEAT Results:')
            console.log('average csa meat complete: ' + csaMeatCompleteTimes/numberOfSuccessfulRequests)
            console.log('average csa meat init: ' + csaMeatInitTimes/numberOfSuccessfulRequests)
            console.log('average csa meat algorithm: ' + csaMeatAlgorithmTimes/numberOfSuccessfulRequests)
            console.log('average csa meat decision graph: ' + csaMeatDecisionGraphTimes/numberOfSuccessfulRequests)
            console.log('CSA ExpAt Results:')
            console.log('average csa eat complete: ' + csaEatCompleteTimes/numberOfSuccessfulRequests)
            console.log('average csa eat init: ' + csaEatInitTimes/numberOfSuccessfulRequests)
            console.log('average csa eat algorithm: ' + csaEatAlgorithmTimes/numberOfSuccessfulRequests)
            console.log('average csa eat decision graph: ' + csaEatDecisionGraphTimes/numberOfSuccessfulRequests)
            console.log('ExpAT vs. Raptor MEAT test:')
            console.log('average absolute difference: ' + absoluteDifference/(numberOfSuccessfulRequests-numberOfExpAtGraphsWithoutBackup))
            console.log('average absolute difference: ' + proportionalDifference/(numberOfSuccessfulRequests-numberOfExpAtGraphsWithoutBackup))
            console.log('number of ExpAT graphs without full backup: ' + numberOfExpAtGraphsWithoutBackup)
            console.log('percentage of ExpAT graphs without full backup: ' + numberOfExpAtGraphsWithoutBackup/numberOfSuccessfulRequests)
            console.log('Approximation MEAT tests:')
            console.log('Average absolute difference csa (in s): ' + csaAbsoluteDifference/numberOfSuccessfulRequests)
            console.log('Average absolute difference raptor (in s): ' + raptorAbsoluteDifference/numberOfSuccessfulRequests)
            console.log('Average proportional difference csa: ' + csaProportionalDifference/numberOfSuccessfulRequests)
            console.log('Average proportional difference raptor: ' + raptorProportionalDifference/numberOfSuccessfulRequests)
            console.log('Known delays results:')
            console.log('average absolute difference:' + knownDelaysAbsoluteDifference/numberOfSuccessfulRequests)
            console.log('average proportional difference:' + knownDelaysProportionalDifference/numberOfSuccessfulRequests)
        }
    }

    /**
     * Creates random requests and checks the result of the csa eat algorithm. Calculates the average time of the algorithm.
     */
     public static testEatAlgorithm(alpha: number) {
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
            const csaResponse = ConnectionScanEatAlgorithmController.testConnectionScanEatAlgorithm(randomSourceStop, randomTargetStop, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
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