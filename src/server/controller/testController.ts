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
import { RaptorMeatTransferOptimationAlgorithmController } from "./raptorMeatTransferOptimationAlgorithmController";

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
        for(let i = 0; i < 100; i++){
            const randomSourceStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomTargetStop = GoogleTransitData.STOPS[this.getRandomInt(numberOfStops)].name;
            const randomSourceTime = this.getRandomInt(numberOfSeconds);
            const randomSourceDate = dates[this.getRandomInt(numberOfDates)];
            let requestString = randomSourceStop + ', ' + randomTargetStop + ', ' + randomSourceDate + ', ' + Converter.secondsToTime(randomSourceTime);
            // console.log('request: ' + requestString)
            let raptorResponse = undefined;
            let csaResponse = undefined;
            csaResponse = ConnectionScanMeatAlgorithmController.testConnectionScanMeatAlgorithm(randomSourceStop, randomTargetStop, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
            raptorResponse = RaptorMeatAlgorithmController.testRaptorMeatAlgorithm(randomSourceStop, randomTargetStop, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
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

        let alphas = [1, 2, 3];

        for(let alpha of alphas){
            console.log('Alpha = ' + alpha + ':')
            let numberOfSuccessfulRequests = 0;

            let raptorMeatRelativeJourneyTime = 0;

            let raptorMeatCompleteTimes = 0;
            let raptorMeatInitTimes = 0;
            let raptorMeatAlgorithmTimes = 0;
            let raptorMeatInitLoopTimes = 0;
            let raptorMeatTraverseRoutesLoopTimes = 0;
            let raptorMeatUpdateExpectedArrivalTimesLoopTimes = 0;
            let raptorMeatDecisionGraphTimes = 0;
            let raptorMeatComputedRounds = 0;
            let raptorMeatRoundsOfResult = 0;
            let raptorMeatNumberOfStopsInGraph = 0;
            let raptorMeatNumberOfLegsInGraph = 0;
            let raptorMeatNumberOfEdgesInGraph = 0;

            let raptorMeatCompleteTimesMax = 0;
            let raptorMeatAlgorithmTimesMax = 0;
            let raptorMeatComputedRoundsMax = 0;
            let raptorMeatRoundsOfResultMax = 0;
            let raptorMeatNumberOfStopsInGraphMax = 0;
            let raptorMeatNumberOfLegsInGraphMax = 0;
            let raptorMeatNumberOfEdgesInGraphMax = 0;

            let raptorMeatTOCompleteTimes = 0;
            let raptorMeatTOInitTimes = 0;
            let raptorMeatTOAlgorithmTimes = 0;
            let raptorMeatTOInitLoopTimes = 0;
            let raptorMeatTOTraverseRoutesLoopTimes = 0;
            let raptorMeatTOUpdateExpectedArrivalTimesLoopTimes = 0;
            let raptorMeatTODecisionGraphTimes = 0;
            let raptorMeatTORoundsOfResult = 0;
            let raptorMeatTONumberOfStopsInGraph = 0;
            let raptorMeatTONumberOfLegsInGraph = 0;
            let raptorMeatTONumberOfEdgesInGraph = 0;

            let raptorMeatTOCompleteTimesMax = 0;
            let raptorMeatTOAlgorithmTimesMax = 0;
            let raptorMeatTORoundsOfResultMax = 0;
            let raptorMeatTONumberOfStopsInGraphMax = 0;
            let raptorMeatTONumberOfLegsInGraphMax = 0;
            let raptorMeatTONumberOfEdgesInGraphMax = 0;

            let raptorMEATAndTOAbsoluteTimeDifference = 0;
            let raptorMEATAndTORelativeTimeDifference = 0;
            let raptorMEATAndTOAbsoluteRoundDifference = 0;
            let raptorMEATAndTORelativeRoundDifference = 0;

            let raptorMEATAndTOAbsoluteTimeDifferenceMax = 0;
            let raptorMEATAndTORelativeTimeDifferenceMax = 0;
            let raptorMEATAndTOAbsoluteRoundDifferenceMax = 0;
            let raptorMEATAndTORelativeRoundDifferenceMax = 0;
    
            let csaMeatCompleteTimes = 0;
            let csaMeatInitTimes = 0;
            let csaMeatAlgorithmTimes = 0;
            let csaMeatDecisionGraphTimes = 0;

            let csaMeatCompleteTimesMax = 0;
            let csaMeatAlgorithmTimesMax = 0;
    
            let csaEatCompleteTimes = 0;
            let csaEatInitTimes = 0;
            let csaEatAlgorithmTimes = 0;
            let csaEatDecisionGraphTimes = 0;

            let csaEatCompleteTimesMax = 0;
            let csaEatAlgorithmTimesMax = 0;
    
            let expATAndRaptorMeatAbsoluteDifference = 0;
            let expATAndRaptorMeatRelativeDifference = 0;
            let numberOfExpAtGraphsWithoutBackup = 0;

            let expATAndRaptorMeatAbsoluteDifferenceMax = 0;
            let expATAndRaptorMeatRelativeDifferenceMax = 0;
    
            let approximationTestsRaptorAbsoluteDifference = 0;
            let approximationTestsCsaAbsoluteDifference = 0;
            let approximationTestsRaptorRelativeDifference = 0;
            let approximationTestsCsaRelativeDifference = 0;

            let alpha1Alpha2AbsoluteDifference = 0;
            let alpha1Alpha3AbsoluteDifference = 0;
            let alpha2Alpha3AbsoluteDifference = 0;
            let alpha1Alpha2RelativeDifference = 0;
            let alpha1Alpha3RelativeDifference = 0;
            let alpha2Alpha3RelativeDifference = 0;

            let alpha1Alpha2AbsoluteDifferenceMax = 0;
            let alpha1Alpha3AbsoluteDifferenceMax = 0;
            let alpha2Alpha3AbsoluteDifferenceMax = 0;
            let alpha1Alpha2RelativeDifferenceMax = 0;
            let alpha1Alpha3RelativeDifferenceMax = 0;
            let alpha2Alpha3RelativeDifferenceMax = 0;

            let knownDelaysAbsoluteDifference = 0;
            let knownDelaysRelativeDifference = 0;

            let knownDelaysAbsoluteDifferenceMax = 0;
            let knownDelaysRelativeDifferenceMax = 0;
    
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

            let diff: number;
            let relDiff: number;
    
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
                
                let raptorMeatResponse = undefined;
                let raptorMeatTOResponse = undefined;
                let csaMeatResponse = undefined;
                let csaExpAtResponse = undefined;
                try{
                    raptorMeatResponse = RaptorMeatAlgorithmController.testRaptorMeatAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
                    raptorMeatTOResponse = RaptorMeatTransferOptimationAlgorithmController.testRaptorMeatTransferOptimationAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha)
                    csaExpAtResponse = ConnectionScanEatAlgorithmController.testConnectionScanEatAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
                    csaMeatResponse = ConnectionScanMeatAlgorithmController.testConnectionScanMeatAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
                } catch(error){
                    if(alpha === 1){
                        i--;
                    }
                    continue;
                }
                if(!raptorMeatResponse || !raptorMeatTOResponse || !csaMeatResponse || !csaExpAtResponse){
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
                        // approximatedResultCSA = ApproximationTestController.performApproximationTestForCsaMeatAlgorithmWithGivenSArray(randomSourceStop, randomTargetStop, csaMeatResponse.sArrary, 10000000);
                        // approximatedResultRaptor = ApproximationTestController.performApproximationTestForRaptorMeatAlgorithmWithGivenExpectedArrivalTimes(randomSourceStop, randomTargetStop, raptorMeatResponse.expectedArrivalTimes, 10000000);
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
    
                    relDiff = (raptorMeatResponse.expectedArrivalTime - randomSourceTime)/(raptorMeatResponse.earliestArrivalTime - randomSourceTime);
                    raptorMeatRelativeJourneyTime += relDiff;

                    raptorMeatCompleteTimes += raptorMeatResponse.completeDuration;
                    if(raptorMeatCompleteTimesMax < raptorMeatResponse.completeDuration){
                        raptorMeatCompleteTimesMax = raptorMeatResponse.completeDuration
                    }
                    raptorMeatInitTimes += raptorMeatResponse.initDuration;
                    raptorMeatAlgorithmTimes += raptorMeatResponse.algorithmDuration;
                    if(raptorMeatAlgorithmTimesMax < raptorMeatResponse.algorithmDuration){
                        raptorMeatAlgorithmTimesMax = raptorMeatResponse.algorithmDuration
                    }
                    raptorMeatInitLoopTimes += raptorMeatResponse.initLoopDuration,
                    raptorMeatTraverseRoutesLoopTimes += raptorMeatResponse.traverseRoutesLoopDuration,
                    raptorMeatUpdateExpectedArrivalTimesLoopTimes += raptorMeatResponse.updateExpectedArrivalTimesLoopDuration,
                    raptorMeatDecisionGraphTimes += raptorMeatResponse.decisionGraphDuration;
                    raptorMeatComputedRounds += raptorMeatResponse.computedRounds;
                    if(raptorMeatComputedRoundsMax < raptorMeatResponse.computedRounds){
                        raptorMeatComputedRoundsMax = raptorMeatResponse.computedRounds
                    }
                    raptorMeatRoundsOfResult += raptorMeatResponse.transferCountOfResult;
                    if(raptorMeatRoundsOfResultMax < raptorMeatResponse.transferCountOfResult){
                        raptorMeatRoundsOfResultMax = raptorMeatResponse.transferCountOfResult
                    }
                    raptorMeatNumberOfStopsInGraph += raptorMeatResponse.numberOfStops;
                    if(raptorMeatNumberOfStopsInGraphMax < raptorMeatResponse.numberOfStops){
                        raptorMeatNumberOfStopsInGraphMax = raptorMeatResponse.numberOfStops
                    }
                    raptorMeatNumberOfLegsInGraph += raptorMeatResponse.numberOfLegs;
                    if(raptorMeatNumberOfLegsInGraphMax < raptorMeatResponse.numberOfLegs){
                        raptorMeatNumberOfLegsInGraphMax = raptorMeatResponse.numberOfLegs
                    }
                    raptorMeatNumberOfEdgesInGraph += raptorMeatResponse.numberOfEdgesInCompactGraph;
                    if(raptorMeatNumberOfEdgesInGraphMax < raptorMeatResponse.numberOfEdgesInCompactGraph){
                        raptorMeatNumberOfEdgesInGraphMax = raptorMeatResponse.numberOfEdgesInCompactGraph
                    }

                    raptorMeatTOCompleteTimes += raptorMeatTOResponse.completeDuration;
                    if(raptorMeatTOCompleteTimesMax < raptorMeatTOResponse.completeDuration){
                        raptorMeatTOCompleteTimesMax = raptorMeatTOResponse.completeDuration
                    }
                    raptorMeatTOInitTimes += raptorMeatTOResponse.initDuration;
                    raptorMeatTOAlgorithmTimes += raptorMeatTOResponse.algorithmDuration;
                    if(raptorMeatTOAlgorithmTimesMax < raptorMeatTOResponse.algorithmDuration){
                        raptorMeatTOAlgorithmTimesMax = raptorMeatTOResponse.algorithmDuration
                    }
                    raptorMeatTOInitLoopTimes += raptorMeatTOResponse.initLoopDuration,
                    raptorMeatTOTraverseRoutesLoopTimes += raptorMeatTOResponse.traverseRoutesLoopDuration,
                    raptorMeatTOUpdateExpectedArrivalTimesLoopTimes += raptorMeatTOResponse.updateExpectedArrivalTimesLoopDuration,
                    raptorMeatTODecisionGraphTimes += raptorMeatTOResponse.decisionGraphDuration;
                    raptorMeatTORoundsOfResult += raptorMeatTOResponse.optimalRound;
                    if(raptorMeatTORoundsOfResultMax < raptorMeatTOResponse.optimalRound){
                        raptorMeatTORoundsOfResultMax = raptorMeatTOResponse.optimalRound
                    }
                    raptorMeatTONumberOfStopsInGraph += raptorMeatTOResponse.numberOfStops;
                    if(raptorMeatTONumberOfStopsInGraphMax < raptorMeatTOResponse.numberOfStops){
                        raptorMeatTONumberOfStopsInGraphMax = raptorMeatTOResponse.numberOfStops
                    }
                    raptorMeatTONumberOfLegsInGraph += raptorMeatTOResponse.numberOfLegs;
                    if(raptorMeatTONumberOfLegsInGraphMax < raptorMeatTOResponse.numberOfLegs){
                        raptorMeatTONumberOfLegsInGraphMax = raptorMeatTOResponse.numberOfLegs
                    }
                    raptorMeatTONumberOfEdgesInGraph += raptorMeatTOResponse.numberOfEdgesInCompactGraph;
                    if(raptorMeatTONumberOfEdgesInGraphMax < raptorMeatTOResponse.numberOfEdgesInCompactGraph){
                        raptorMeatTONumberOfEdgesInGraphMax = raptorMeatTOResponse.numberOfEdgesInCompactGraph
                    }
                    
                    diff = raptorMeatTOResponse.expectedArrivalTime - raptorMeatResponse.expectedArrivalTime;
                    raptorMEATAndTOAbsoluteTimeDifference += diff;
                    if(raptorMEATAndTOAbsoluteTimeDifferenceMax < diff){
                        raptorMEATAndTOAbsoluteTimeDifferenceMax = diff
                    }
                    relDiff = (diff)/(raptorMeatResponse.earliestArrivalTime - randomSourceTime);
                    raptorMEATAndTORelativeTimeDifference += relDiff;
                    if(raptorMEATAndTORelativeTimeDifferenceMax < relDiff){
                        raptorMEATAndTORelativeTimeDifferenceMax = relDiff
                    }
                    diff = raptorMeatResponse.transferCountOfResult - raptorMeatTOResponse.optimalRound;
                    raptorMEATAndTOAbsoluteRoundDifference += diff;
                    if(raptorMEATAndTOAbsoluteRoundDifferenceMax < diff){
                        raptorMEATAndTOAbsoluteRoundDifferenceMax = diff
                    }
                    relDiff = (diff)/raptorMeatResponse.transferCountOfResult;
                    raptorMEATAndTORelativeRoundDifference += relDiff;
                    if(raptorMEATAndTORelativeRoundDifferenceMax < relDiff){
                        raptorMEATAndTORelativeRoundDifferenceMax = relDiff
                    }

                    if(alpha === 2){
                        diff = Math.abs(alpha1ExpectedArrivalTimes[i] - raptorMeatResponse.expectedArrivalTime);
                        alpha1Alpha2AbsoluteDifference += diff;
                        if(alpha1Alpha2AbsoluteDifferenceMax < diff){
                            alpha1Alpha2AbsoluteDifferenceMax = diff
                        }
                        relDiff = Math.abs(diff/(raptorMeatResponse.earliestArrivalTime - randomSourceTime))
                        alpha1Alpha2RelativeDifference += relDiff
                        if(alpha1Alpha2RelativeDifferenceMax < relDiff){
                            alpha1Alpha2RelativeDifferenceMax = relDiff
                        }

                    } else if(alpha === 3){
                        diff = Math.abs(alpha1ExpectedArrivalTimes[i] - raptorMeatResponse.expectedArrivalTime);
                        alpha1Alpha3AbsoluteDifference += diff;
                        if(alpha1Alpha3AbsoluteDifferenceMax < diff){
                            alpha1Alpha3AbsoluteDifferenceMax = diff
                        }
                        relDiff = Math.abs(diff/(raptorMeatResponse.earliestArrivalTime - randomSourceTime))
                        alpha1Alpha3RelativeDifference += relDiff;
                        if(alpha1Alpha3RelativeDifferenceMax < relDiff){
                            alpha1Alpha3RelativeDifferenceMax = relDiff
                        }
                        diff = Math.abs(alpha2ExpectedArrivalTimes[i] - raptorMeatResponse.expectedArrivalTime);
                        alpha2Alpha3AbsoluteDifference += diff;
                        if(alpha2Alpha3AbsoluteDifferenceMax < diff){
                            alpha2Alpha3AbsoluteDifferenceMax = diff
                        }
                        relDiff = Math.abs(diff/(raptorMeatResponse.earliestArrivalTime - randomSourceTime));
                        alpha2Alpha3RelativeDifference += relDiff;
                        if(alpha2Alpha3RelativeDifferenceMax < relDiff){
                            alpha2Alpha3RelativeDifferenceMax = relDiff
                        }
                    }
    
                    csaMeatCompleteTimes += csaMeatResponse.completeDuration;
                    if(csaMeatCompleteTimesMax < csaMeatResponse.completeDuration){
                        csaMeatCompleteTimesMax = csaMeatResponse.completeDuration
                    }
                    csaMeatInitTimes += csaMeatResponse.initDuration;
                    csaMeatAlgorithmTimes += csaMeatResponse.algorithmDuration;
                    if(csaMeatAlgorithmTimesMax < csaMeatResponse.algorithmDuration){
                        csaMeatAlgorithmTimesMax = csaMeatResponse.algorithmDuration
                    }
                    csaMeatDecisionGraphTimes += csaMeatResponse.decisionGraphDuration;
    
                    csaEatCompleteTimes += csaExpAtResponse.completeDuration;
                    if(csaEatCompleteTimesMax < csaExpAtResponse.completeDuration){
                        csaEatCompleteTimesMax = csaExpAtResponse.completeDuration
                    }
                    csaEatInitTimes += csaExpAtResponse.initDuration;
                    csaEatAlgorithmTimes += csaExpAtResponse.algorithmDuration;
                    if(csaEatAlgorithmTimesMax < csaExpAtResponse.algorithmDuration){
                        csaEatAlgorithmTimesMax = csaExpAtResponse.algorithmDuration
                    }
                    csaEatDecisionGraphTimes += csaExpAtResponse.decisionGraphDuration;
    
                    if(csaExpAtResponse.expectedArrivalTime !== Number.MAX_VALUE){
                        diff = csaExpAtResponse.expectedArrivalTime - raptorMeatResponse.expectedArrivalTime;
                        expATAndRaptorMeatAbsoluteDifference += diff;
                        if(expATAndRaptorMeatAbsoluteDifferenceMax < diff){
                            expATAndRaptorMeatAbsoluteDifferenceMax = diff
                        }
                        relDiff = diff/(raptorMeatResponse.earliestArrivalTime - randomSourceTime);
                        expATAndRaptorMeatRelativeDifference += relDiff;
                        if(expATAndRaptorMeatRelativeDifferenceMax < relDiff){
                            expATAndRaptorMeatRelativeDifferenceMax = relDiff
                        }
                    } else {
                        numberOfExpAtGraphsWithoutBackup++;
                    }
    
                    // diff = Math.abs(csaMeatResponse.expectedArrivalTime - approximatedResultCSA);
                    // approximationTestsCsaAbsoluteDifference += diff;
                    // relDiff = Math.abs(diff/(raptorMeatResponse.earliestArrivalTime - randomSourceTime));
                    // approximationTestsCsaRelativeDifference += relDiff;
                    // diff = Math.abs(raptorMeatResponse.expectedArrivalTime - approximatedResultRaptor);
                    // approximationTestsRaptorAbsoluteDifference += diff;
                    // relDiff = Math.abs(diff/(raptorMeatResponse.earliestArrivalTime - randomSourceTime));
                    // approximationTestsRaptorRelativeDifference += relDiff;
                
                    diff = (knownDelayResultRaptorMEAT - knownDelayResultCSA);
                    knownDelaysAbsoluteDifference += diff;
                    if(knownDelaysAbsoluteDifferenceMax < diff){
                        knownDelaysAbsoluteDifferenceMax = diff
                    }
                    relDiff = diff/(raptorMeatResponse.earliestArrivalTime - randomSourceTime);
                    knownDelaysRelativeDifference += relDiff;
                    if(knownDelaysRelativeDifferenceMax < relDiff){
                        knownDelaysRelativeDifferenceMax = relDiff
                    }
                }
            }
            console.log('Raptor MEAT Results:')
            console.log('Times:')
            console.log('average raptor meat relative journey time: ' + raptorMeatRelativeJourneyTime/numberOfSuccessfulRequests)
            console.log('average raptor meat complete: ' + raptorMeatCompleteTimes/numberOfSuccessfulRequests)
            console.log('maximum raptor meat complete: ' + raptorMeatCompleteTimesMax)
            console.log('average raptor meat init: ' + raptorMeatInitTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat algorithm: ' + raptorMeatAlgorithmTimes/numberOfSuccessfulRequests)
            console.log('maximum raptor meat algorithm: ' + raptorMeatAlgorithmTimesMax)
            console.log('average raptor meat init loop of algorithm: ' + raptorMeatInitLoopTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat traverse routes loop of algorithm: ' + raptorMeatTraverseRoutesLoopTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat update expected arrival times loop of algorithm: ' + raptorMeatUpdateExpectedArrivalTimesLoopTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat decision graph: ' + raptorMeatDecisionGraphTimes/numberOfSuccessfulRequests)
            console.log('Additional infos:')
            console.log('average raptor meat computed rounds: ' + raptorMeatComputedRounds/numberOfSuccessfulRequests)
            console.log('maximum raptor meat computed rounds: ' + raptorMeatComputedRoundsMax)
            console.log('average raptor meat rounds of result: ' + raptorMeatRoundsOfResult/numberOfSuccessfulRequests)
            console.log('maximum raptor meat rounds of result: ' + raptorMeatRoundsOfResultMax)
            console.log('average raptor meat number of stops in graph: ' + raptorMeatNumberOfStopsInGraph/numberOfSuccessfulRequests)
            console.log('maximum raptor meat number of stops in graph: ' + raptorMeatNumberOfStopsInGraphMax)
            console.log('average raptor meat number of legs in graph: ' + raptorMeatNumberOfLegsInGraph/numberOfSuccessfulRequests)
            console.log('maximum raptor meat number of legs in graph: ' + raptorMeatNumberOfLegsInGraphMax)
            console.log('average raptor meat number of edges in compact graph: ' + raptorMeatNumberOfEdgesInGraph/numberOfSuccessfulRequests)
            console.log('maximum raptor meat number of edges in compact graph: ' + raptorMeatNumberOfEdgesInGraphMax)
            if(alpha === 2){
                console.log('Different alpha value Results:')
                console.log('average alpha = 1 vs. alpha = 2 absolute difference: ' + alpha1Alpha2AbsoluteDifference/numberOfSuccessfulRequests)
                console.log('maximum alpha = 1 vs. alpha = 2 absolute difference: ' + alpha1Alpha2AbsoluteDifferenceMax)
                console.log('average alpha = 1 vs. alpha = 2 relative difference: ' + alpha1Alpha2RelativeDifference/numberOfSuccessfulRequests)
                console.log('maximum alpha = 1 vs. alpha = 2 relative difference: ' + alpha1Alpha2RelativeDifferenceMax)
            } else if(alpha === 3){
                console.log('Different alpha value Results:')
                console.log('average alpha = 1 vs. alpha = 3 absolute difference: ' + alpha1Alpha3AbsoluteDifference/numberOfSuccessfulRequests)
                console.log('maximum alpha = 1 vs. alpha = 3 absolute difference: ' + alpha1Alpha3AbsoluteDifferenceMax)
                console.log('average alpha = 1 vs. alpha = 3 relative difference: ' + alpha1Alpha3RelativeDifference/numberOfSuccessfulRequests)
                console.log('maximum alpha = 1 vs. alpha = 3 relative difference: ' + alpha1Alpha3RelativeDifferenceMax)
                console.log('average alpha = 2 vs. alpha = 3 absolute difference: ' + alpha2Alpha3AbsoluteDifference/numberOfSuccessfulRequests)
                console.log('maximum alpha = 2 vs. alpha = 3 absolute difference: ' + alpha2Alpha3AbsoluteDifferenceMax)
                console.log('average alpha = 2 vs. alpha = 3 relative difference: ' + alpha2Alpha3RelativeDifference/numberOfSuccessfulRequests)
                console.log('maximum alpha = 2 vs. alpha = 3 relative difference: ' + alpha2Alpha3RelativeDifferenceMax)
            }
            console.log('CSA MEAT Results:')
            console.log('average csa meat complete: ' + csaMeatCompleteTimes/numberOfSuccessfulRequests)
            console.log('maximum csa meat complete: ' + csaMeatCompleteTimesMax)
            console.log('average csa meat init: ' + csaMeatInitTimes/numberOfSuccessfulRequests)
            console.log('average csa meat algorithm: ' + csaMeatAlgorithmTimes/numberOfSuccessfulRequests)
            console.log('maximum csa meat algorithm: ' + csaMeatAlgorithmTimesMax)
            console.log('average csa meat decision graph: ' + csaMeatDecisionGraphTimes/numberOfSuccessfulRequests)
            console.log('CSA ExpAt Results:')
            console.log('average csa eat complete: ' + csaEatCompleteTimes/numberOfSuccessfulRequests)
            console.log('maximum csa eat complete: ' + csaEatCompleteTimesMax)
            console.log('average csa eat init: ' + csaEatInitTimes/numberOfSuccessfulRequests)
            console.log('average csa eat algorithm: ' + csaEatAlgorithmTimes/numberOfSuccessfulRequests)
            console.log('maximum csa eat algorithm: ' + csaEatAlgorithmTimesMax)
            console.log('average csa eat decision graph: ' + csaEatDecisionGraphTimes/(numberOfSuccessfulRequests-numberOfExpAtGraphsWithoutBackup))
            console.log('ExpAT vs. Raptor MEAT test:')
            console.log('average absolute difference: ' + expATAndRaptorMeatAbsoluteDifference/(numberOfSuccessfulRequests-numberOfExpAtGraphsWithoutBackup))
            console.log('maximum absolute difference: ' + expATAndRaptorMeatAbsoluteDifferenceMax)
            console.log('average absolute difference: ' + expATAndRaptorMeatRelativeDifference/(numberOfSuccessfulRequests-numberOfExpAtGraphsWithoutBackup))
            console.log('maximum absolute difference: ' + expATAndRaptorMeatRelativeDifferenceMax)
            console.log('number of ExpAT graphs without full backup: ' + numberOfExpAtGraphsWithoutBackup)
            console.log('percentage of ExpAT graphs without full backup: ' + numberOfExpAtGraphsWithoutBackup/numberOfSuccessfulRequests)
            // console.log('Approximation MEAT tests:')
            // console.log('Average absolute difference csa (in s): ' + approximationTestsCsaAbsoluteDifference/numberOfSuccessfulRequests)
            // console.log('Average absolute difference raptor (in s): ' + approximationTestsRaptorAbsoluteDifference/numberOfSuccessfulRequests)
            // console.log('Average relative difference csa: ' + approximationTestsCsaRelativeDifference/numberOfSuccessfulRequests)
            // console.log('Average relative difference raptor: ' + approximationTestsRaptorRelativeDifference/numberOfSuccessfulRequests)
            console.log('Known delays results:')
            console.log('average absolute difference:' + knownDelaysAbsoluteDifference/numberOfSuccessfulRequests)
            console.log('maximum absolute difference:' + knownDelaysAbsoluteDifferenceMax)
            console.log('average relative difference:' + knownDelaysRelativeDifference/numberOfSuccessfulRequests)
            console.log('maximum relative difference:' + knownDelaysRelativeDifferenceMax)
            console.log('Raptor MEAT Transfer Optimation Results:')
            console.log('Times:')
            console.log('average raptor meat TO complete: ' + raptorMeatTOCompleteTimes/numberOfSuccessfulRequests)
            console.log('maximum raptor meat TO complete: ' + raptorMeatTOCompleteTimesMax)
            console.log('average raptor meat TO init: ' + raptorMeatTOInitTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat TO algorithm: ' + raptorMeatTOAlgorithmTimes/numberOfSuccessfulRequests)
            console.log('maximum raptor meat TO algorithm: ' + raptorMeatTOAlgorithmTimesMax)
            console.log('average raptor meat TO init loop of algorithm: ' + raptorMeatTOInitLoopTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat TO traverse routes loop of algorithm: ' + raptorMeatTOTraverseRoutesLoopTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat TO update expected arrival times loop of algorithm: ' + raptorMeatTOUpdateExpectedArrivalTimesLoopTimes/numberOfSuccessfulRequests)
            console.log('average raptor meat TO decision graph: ' + raptorMeatTODecisionGraphTimes/numberOfSuccessfulRequests)
            console.log('Additional infos:')
            console.log('average raptor meat TO rounds of result: ' + raptorMeatTORoundsOfResult/numberOfSuccessfulRequests)
            console.log('maximum raptor meat TO rounds of result: ' + raptorMeatTORoundsOfResultMax)
            console.log('average raptor meat TO number of stops in graph: ' + raptorMeatTONumberOfStopsInGraph/numberOfSuccessfulRequests)
            console.log('maximum raptor meat TO number of stops in graph: ' + raptorMeatTONumberOfStopsInGraphMax)
            console.log('average raptor meat TO number of legs in graph: ' + raptorMeatTONumberOfLegsInGraph/numberOfSuccessfulRequests)
            console.log('maximum raptor meat TO number of legs in graph: ' + raptorMeatTONumberOfLegsInGraphMax)
            console.log('average raptor meat TO number of edges in compact graph: ' + raptorMeatTONumberOfEdgesInGraph/numberOfSuccessfulRequests)
            console.log('maximum raptor meat TO number of edges in compact graph: ' + raptorMeatTONumberOfEdgesInGraphMax)
            console.log('Raptor MEAT vs. Raptor MEAT TO Results:')
            console.log('average expected arrival time absolute difference (in s): ' + raptorMEATAndTOAbsoluteTimeDifference/numberOfSuccessfulRequests)
            console.log('maximum expected arrival time absolute difference (in s): ' + raptorMEATAndTOAbsoluteTimeDifferenceMax)
            console.log('average expected arrival time relative difference: ' + raptorMEATAndTORelativeTimeDifference/numberOfSuccessfulRequests)
            console.log('maximum expected arrival time relative difference: ' + raptorMEATAndTORelativeTimeDifferenceMax)
            console.log('average round absolute difference: ' + raptorMEATAndTOAbsoluteRoundDifference/numberOfSuccessfulRequests)
            console.log('maximum round absolute difference: ' + raptorMEATAndTOAbsoluteRoundDifferenceMax)
            console.log('average round relative difference: ' + raptorMEATAndTORelativeRoundDifference/numberOfSuccessfulRequests)
            console.log('maximum round relative difference: ' + raptorMEATAndTORelativeRoundDifferenceMax)
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