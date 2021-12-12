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
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

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
            for(let i = 0; i < 20; i++){
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
    
                    relDiff = (raptorMeatResponse.expectedArrivalTime - randomSourceTime)/(raptorMeatResponse.earliestSafeArrivalTime - randomSourceTime);
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
                    relDiff = (diff)/(raptorMeatResponse.earliestSafeArrivalTime - randomSourceTime);
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
                        relDiff = Math.abs(diff/(raptorMeatResponse.earliestSafeArrivalTime - randomSourceTime))
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
                        relDiff = Math.abs(diff/(raptorMeatResponse.earliestSafeArrivalTime - randomSourceTime))
                        alpha1Alpha3RelativeDifference += relDiff;
                        if(alpha1Alpha3RelativeDifferenceMax < relDiff){
                            alpha1Alpha3RelativeDifferenceMax = relDiff
                        }
                        diff = Math.abs(alpha2ExpectedArrivalTimes[i] - raptorMeatResponse.expectedArrivalTime);
                        alpha2Alpha3AbsoluteDifference += diff;
                        if(alpha2Alpha3AbsoluteDifferenceMax < diff){
                            alpha2Alpha3AbsoluteDifferenceMax = diff
                        }
                        relDiff = Math.abs(diff/(raptorMeatResponse.earliestSafeArrivalTime - randomSourceTime));
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
                        relDiff = diff/(raptorMeatResponse.earliestSafeArrivalTime - randomSourceTime);
                        expATAndRaptorMeatRelativeDifference += relDiff;
                        if(expATAndRaptorMeatRelativeDifferenceMax < relDiff){
                            expATAndRaptorMeatRelativeDifferenceMax = relDiff
                        }
                    } else {
                        numberOfExpAtGraphsWithoutBackup++;
                    }
    
                    // diff = Math.abs(csaMeatResponse.expectedArrivalTime - approximatedResultCSA);
                    // approximationTestsCsaAbsoluteDifference += diff;
                    // relDiff = Math.abs(diff/(raptorMeatResponse.earliestSafeArrivalTime - randomSourceTime));
                    // approximationTestsCsaRelativeDifference += relDiff;
                    // diff = Math.abs(raptorMeatResponse.expectedArrivalTime - approximatedResultRaptor);
                    // approximationTestsRaptorAbsoluteDifference += diff;
                    // relDiff = Math.abs(diff/(raptorMeatResponse.earliestSafeArrivalTime - randomSourceTime));
                    // approximationTestsRaptorRelativeDifference += relDiff;
                
                    diff = (knownDelayResultRaptorMEAT - knownDelayResultCSA);
                    knownDelaysAbsoluteDifference += diff;
                    if(knownDelaysAbsoluteDifferenceMax < diff){
                        knownDelaysAbsoluteDifferenceMax = diff
                    }
                    relDiff = diff/(raptorMeatResponse.earliestSafeArrivalTime - randomSourceTime);
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

    public static async performAllTestsAndSafeInCSVInit(){
        console.time('tests')
        await TestController.performAllTestsAndSafeInCSV();
        console.timeEnd('tests')
    }

    public static async performApproximationTestsAndSafeInCSVInit(){
        console.time('tests')
        await TestController.performApproximationTestsAndSafeInCSV();
        console.timeEnd('tests')
    }

    private static async importRequests(numberOfFilesPerAlpha: number){
        let requests: RequestInfo[] = [];
        for(let i = 0; i < numberOfFilesPerAlpha; i++){
            let importPath = path.join('test_data', 'dm2_alpha1v' + i + '.csv');
            await new Promise<void>((resolve) => {
                fs.createReadStream(importPath)
                    .pipe(csv())
                    .on('data', (row) => {
                        const dateParts = row['Source Date'].split('.');
                        let request: RequestInfo = {
                            sourceStop: GoogleTransitData.getStopIdByName(row['Source Stop']),
                            targetStop: GoogleTransitData.getStopIdByName(row['Target Stop']),
                            sourceTime: Number(row['Source Time']),
                            sourceDate: new Date(Number(dateParts[2]), Number(dateParts[1])-1, Number(dateParts[0])),
                        }
                        requests.push(request)
                    })
                    .on('finish', () => {
                        console.log('CSV file successfully processed');
                        resolve();
                    })
            })
        }
        return requests;
    }

    /**
     * Creates random requests and compares the results of Raptor Meat and CSA Meat. Calculates the average time of both algorithms.
     */
     private static async performAllTestsAndSafeInCSV() {
        let requests: RequestInfo[] = [];

        DelayTestController.addDelaysToTrips();

        let alphas = [1, 2, 3];

        let numberOfFilesPerAlpha = 20;
        let numberOfRequestsPerFile = 50;

        requests = await this.importRequests(numberOfFilesPerAlpha);

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

        

        for(let alpha of alphas){
            console.log('Alpha = ' + alpha + ':')
            for(let j = 0; j < numberOfFilesPerAlpha; j++){
                const csvWriter = createCsvWriter({
                    path: path.join('test_data', 'dm1_alpha' + alpha + 'v' + j + '.csv'),
                    header: [
                        {id: 'sourceStop', title: 'Source Stop'},
                        {id: 'targetStop', title: 'Target Stop'},
                        {id: 'sourceTime', title: 'Source Time'},
                        {id: 'sourceDate', title: 'Source Date'},
                        {id: 'eat', title: 'EAT'},
                        {id: 'esat', title: 'ESAT'},
                        {id: 'meat', title: 'MEAT'},
                        {id: 'raptorMeatComplete', title: 'Raptor MEAT Complete'},
                        {id: 'raptorMeatInit', title: 'Raptor MEAT Init'},
                        {id: 'raptorMeatAlgorithm', title: 'Raptor MEAT Algorithm'},
                        {id: 'raptorMeatInitLoop', title: 'Raptor MEAT Init Loop'},
                        {id: 'raptorMeatTraverseRoutesLoop', title: 'Raptor MEAT Traverse Routes Loop'},
                        {id: 'raptorMeatUpdateLoop', title: 'Raptor MEAT Update Loop'},
                        {id: 'raptorMeatDecisionGraph', title: 'Raptor MEAT Decision Graph'},
                        {id: 'raptorMeatComputedRounds', title: 'Raptor MEAT Computed Rounds'},
                        {id: 'raptorMeatRoundsOfResult', title: 'Raptor MEAT Rounds Of Result'},
                        {id: 'raptorMeatGraphStops', title: 'Raptor MEAT Stops in Graph'},
                        {id: 'raptorMeatGraphLegs', title: 'Raptor MEAT Legs in Graph'},
                        {id: 'raptorMeatGraphEdges', title: 'Raptor MEAT Edges in Graph'},
                        {id: 'raptorMeatTOExpAT', title: 'Raptor MEAT TO ExpAT'},
                        {id: 'raptorMeatTOComplete', title: 'Raptor MEAT TO Complete'},
                        {id: 'raptorMeatTOInit', title: 'Raptor MEAT TO Init'},
                        {id: 'raptorMeatTOAlgorithm', title: 'Raptor MEAT TO Algorithm'},
                        {id: 'raptorMeatTOInitLoop', title: 'Raptor MEAT TO Init Loop'},
                        {id: 'raptorMeatTOTraverseRoutesLoop', title: 'Raptor MEAT TO Traverse Routes Loop'},
                        {id: 'raptorMeatTOUpdateLoop', title: 'Raptor MEAT TO Update Loop'},
                        {id: 'raptorMeatTODecisionGraph', title: 'Raptor MEAT TO Decision Graph'},
                        {id: 'raptorMeatTORoundsOfResult', title: 'Raptor MEAT TO Rounds Of Result'},
                        {id: 'raptorMeatTOGraphStops', title: 'Raptor MEAT TO Stops in Graph'},
                        {id: 'raptorMeatTOGraphLegs', title: 'Raptor MEAT TO Legs in Graph'},
                        {id: 'raptorMeatTOGraphEdges', title: 'Raptor MEAT TO Edges in Graph'},
                        {id: 'csaExpATExpAT', title: 'CSA ExpAT'},
                        {id: 'csaExpATComplete', title: 'CSA ExpAT Complete'},
                        {id: 'csaExpATInit', title: 'CSA ExpAT Init'},
                        {id: 'csaExpATAlgorithm', title: 'CSA ExpAT Algorithm'},
                        {id: 'csaExpATDecisionGraph', title: 'CSA ExpAT Decision Graph'},
                        {id: 'csaMEATComplete', title: 'CSA MEAT Complete'},
                        {id: 'csaMEATInit', title: 'CSA MEAT Init'},
                        {id: 'csaMEATAlgorithm', title: 'CSA MEAT Algorithm'},
                        {id: 'csaMEATDecisionGraph', title: 'CSA MEAT Decision Graph'},
                        {id: 'csaATKnownDelay', title: 'CSA AT Known Delay'},
                        {id: 'raptorMEATKnownDelay', title: 'Raptor MEAT AT Known Delay'},
                        {id: 'raptorMeatTBExpAT1', title: 'Raptor MEAT TB ExpAT 1'},
                        {id: 'raptorMeatTBExpAT2', title: 'Raptor MEAT TB ExpAT 2'},
                        {id: 'raptorMeatTBExpAT3', title: 'Raptor MEAT TB ExpAT 3'},
                        {id: 'raptorMeatTBExpAT4', title: 'Raptor MEAT TB ExpAT 4'},
                        {id: 'raptorMeatTBExpAT5', title: 'Raptor MEAT TB ExpAT 5'},
                        {id: 'raptorMeatTBExpAT6', title: 'Raptor MEAT TB ExpAT 6'},
                        {id: 'raptorMeatTBExpAT7', title: 'Raptor MEAT TB ExpAT 7'},
                        {id: 'raptorMeatTBExpAT8', title: 'Raptor MEAT TB ExpAT 8'},
                        {id: 'raptorMeatTBExpAT9', title: 'Raptor MEAT TB ExpAT 9'},
                        {id: 'raptorMeatTBExpAT10', title: 'Raptor MEAT TB ExpAT 10'},
                        {id: 'raptorMeatTBAlgorithm1', title: 'Raptor MEAT TB Algorithm 1'},
                        {id: 'raptorMeatTBAlgorithm2', title: 'Raptor MEAT TB Algorithm 2'},
                        {id: 'raptorMeatTBAlgorithm3', title: 'Raptor MEAT TB Algorithm 3'},
                        {id: 'raptorMeatTBAlgorithm4', title: 'Raptor MEAT TB Algorithm 4'},
                        {id: 'raptorMeatTBAlgorithm5', title: 'Raptor MEAT TB Algorithm 5'},
                        {id: 'raptorMeatTBAlgorithm6', title: 'Raptor MEAT TB Algorithm 6'},
                        {id: 'raptorMeatTBAlgorithm7', title: 'Raptor MEAT TB Algorithm 7'},
                        {id: 'raptorMeatTBAlgorithm8', title: 'Raptor MEAT TB Algorithm 8'},
                        {id: 'raptorMeatTBAlgorithm9', title: 'Raptor MEAT TB Algorithm 9'},
                        {id: 'raptorMeatTBAlgorithm10', title: 'Raptor MEAT TB Algorithm 10'},
                    ]
                })
                const csvData = [];
    
                
        
                let randomSourceStop: number;
                let randomSourceStopName: string;
                let randomTargetStop: number;
                let randomTargetStopName: string;
                let randomSourceTime: number;
                let randomSourceDate: Date;
                for(let i = 0; i < numberOfRequestsPerFile; i++){
                    if(requests.length < numberOfFilesPerAlpha * numberOfRequestsPerFile){
                        randomSourceStop = this.getRandomInt(numberOfStops);
                        randomTargetStop = this.getRandomInt(numberOfStops);
                        randomSourceTime = this.getRandomInt(numberOfSeconds);
                        randomSourceDate = dates[this.getRandomInt(numberOfDates)];
                    } else {
                        randomSourceStop = requests[i + j*numberOfRequestsPerFile].sourceStop;
                        randomTargetStop = requests[i + j*numberOfRequestsPerFile].targetStop;
                        randomSourceTime = requests[i + j*numberOfRequestsPerFile].sourceTime;
                        randomSourceDate = requests[i + j*numberOfRequestsPerFile].sourceDate;
                    }
                    randomSourceStopName = GoogleTransitData.STOPS[randomSourceStop].name;
                    randomTargetStopName = GoogleTransitData.STOPS[randomTargetStop].name;
                    
                    let raptorMeatResponse = undefined;
                    let raptorMeatTOResponse = undefined;
                    let csaMeatResponse = undefined;
                    let csaExpAtResponse = undefined;
                    let knownDelayResultCSA = undefined;
                    let knownDelayResultRaptorMEAT = undefined;
                    try{
                        raptorMeatResponse = RaptorMeatAlgorithmController.testRaptorMeatAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
                        if(!raptorMeatResponse){
                            throw new Error();
                        }
                        raptorMeatTOResponse = RaptorMeatTransferOptimationAlgorithmController.testRaptorMeatTransferOptimationAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha)
                        if(!raptorMeatTOResponse){
                            throw new Error();
                        }
                        csaExpAtResponse = ConnectionScanEatAlgorithmController.testConnectionScanEatAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
                        if(!csaExpAtResponse){
                            throw new Error();
                        }
                        csaMeatResponse = ConnectionScanMeatAlgorithmController.testConnectionScanMeatAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
                        if(!csaMeatResponse){
                            throw new Error();
                        }
                        // approximatedResultCSA = ApproximationTestController.performApproximationTestForCsaMeatAlgorithmWithGivenSArray(randomSourceStop, randomTargetStop, csaMeatResponse.sArrary, 10000000);
                        // approximatedResultRaptor = ApproximationTestController.performApproximationTestForRaptorMeatAlgorithmWithGivenExpectedArrivalTimes(randomSourceStop, randomTargetStop, raptorMeatResponse.expectedArrivalTimes, 10000000);
                        knownDelayResultCSA = DelayTestController.getEarliestArrivalTimeCSA(randomSourceStop, randomTargetStop, randomSourceTime, randomSourceDate);
                        if(!knownDelayResultCSA){
                            throw new Error();
                        }
                        knownDelayResultRaptorMEAT = DelayTestController.getEarliestArrivalTimeRaptorMeat(randomSourceStop, randomTargetStop, raptorMeatResponse.expectedArrivalTimes);
                        if(!knownDelayResultRaptorMEAT){
                            throw new Error();
                        }
                    } catch(error){
                        if(requests.length < numberOfFilesPerAlpha * numberOfRequestsPerFile){
                            i--;
                        }
                        continue;
                    }
                    if(requests.length < numberOfFilesPerAlpha * numberOfRequestsPerFile){
                        const request: RequestInfo = {
                            sourceStop: randomSourceStop,
                            targetStop: randomTargetStop,
                            sourceTime: randomSourceTime,
                            sourceDate: randomSourceDate,
                        }
                        requests.push(request);
                    }
                    const data = {
                        sourceStop: randomSourceStopName,
                        targetStop: randomTargetStopName,
                        sourceTime: randomSourceTime,
                        sourceDate: randomSourceDate.toLocaleDateString('de-DE'),
                        eat: raptorMeatResponse.earliestArrivalTime,
                        esat: raptorMeatResponse.earliestSafeArrivalTime,
                        meat: raptorMeatResponse.expectedArrivalTime,
                        raptorMeatComplete: raptorMeatResponse.completeDuration,
                        raptorMeatInit: raptorMeatResponse.initDuration,
                        raptorMeatAlgorithm: raptorMeatResponse.algorithmDuration,
                        raptorMeatInitLoop: raptorMeatResponse.initLoopDuration,
                        raptorMeatTraverseRoutesLoop: raptorMeatResponse.traverseRoutesLoopDuration,
                        raptorMeatUpdateLoop: raptorMeatResponse.updateExpectedArrivalTimesLoopDuration,
                        raptorMeatDecisionGraph: raptorMeatResponse.decisionGraphDuration,
                        raptorMeatComputedRounds: raptorMeatResponse.computedRounds,
                        raptorMeatRoundsOfResult: raptorMeatResponse.transferCountOfResult,
                        raptorMeatGraphStops: raptorMeatResponse.numberOfStops,
                        raptorMeatGraphLegs: raptorMeatResponse.numberOfLegs,
                        raptorMeatGraphEdges: raptorMeatResponse.numberOfEdgesInCompactGraph,
                        raptorMeatTOExpAT: raptorMeatTOResponse.expectedArrivalTime,
                        raptorMeatTOComplete: raptorMeatTOResponse.completeDuration,
                        raptorMeatTOInit: raptorMeatTOResponse.initDuration,
                        raptorMeatTOAlgorithm: raptorMeatTOResponse.algorithmDuration,
                        raptorMeatTOInitLoop: raptorMeatTOResponse.initLoopDuration,
                        raptorMeatTOTraverseRoutesLoop: raptorMeatTOResponse.traverseRoutesLoopDuration,
                        raptorMeatTOUpdateLoop: raptorMeatTOResponse.updateExpectedArrivalTimesLoopDuration,
                        raptorMeatTODecisionGraph: raptorMeatTOResponse.decisionGraphDuration,
                        raptorMeatTORoundsOfResult: raptorMeatTOResponse.optimalRound,
                        raptorMeatTOGraphStops: raptorMeatTOResponse.numberOfStops,
                        raptorMeatTOGraphLegs: raptorMeatTOResponse.numberOfLegs,
                        raptorMeatTOGraphEdges: raptorMeatTOResponse.numberOfEdgesInCompactGraph,
                        csaExpATExpAT: csaExpAtResponse.expectedArrivalTime,
                        csaExpATComplete: csaExpAtResponse.completeDuration,
                        csaExpATInit: csaExpAtResponse.initDuration,
                        csaExpATAlgorithm: csaExpAtResponse.algorithmDuration,
                        csaExpATDecisionGraph: csaExpAtResponse.decisionGraphDuration,
                        csaMEATComplete: csaMeatResponse.completeDuration,
                        csaMEATInit: csaMeatResponse.initDuration,
                        csaMEATAlgorithm: csaMeatResponse.algorithmDuration,
                        csaMEATDecisionGraph: csaMeatResponse.decisionGraphDuration,
                        csaATKnownDelay: knownDelayResultCSA,
                        raptorMEATKnownDelay: knownDelayResultRaptorMEAT,
                        raptorMeatTBExpAT1: raptorMeatTOResponse.meatResults[1],
                        raptorMeatTBExpAT2: raptorMeatTOResponse.meatResults[2],
                        raptorMeatTBExpAT3: raptorMeatTOResponse.meatResults[3],
                        raptorMeatTBExpAT4: raptorMeatTOResponse.meatResults[4],
                        raptorMeatTBExpAT5: raptorMeatTOResponse.meatResults[5],
                        raptorMeatTBExpAT6: raptorMeatTOResponse.meatResults[6],
                        raptorMeatTBExpAT7: raptorMeatTOResponse.meatResults[7],
                        raptorMeatTBExpAT8: raptorMeatTOResponse.meatResults[8],
                        raptorMeatTBExpAT9: raptorMeatTOResponse.meatResults[9],
                        raptorMeatTBExpAT10: raptorMeatTOResponse.meatResults[10],
                        raptorMeatTBAlgorithm1: raptorMeatTOResponse.algorithmDurations[1],
                        raptorMeatTBAlgorithm2: raptorMeatTOResponse.algorithmDurations[2],
                        raptorMeatTBAlgorithm3: raptorMeatTOResponse.algorithmDurations[3],
                        raptorMeatTBAlgorithm4: raptorMeatTOResponse.algorithmDurations[4],
                        raptorMeatTBAlgorithm5: raptorMeatTOResponse.algorithmDurations[5],
                        raptorMeatTBAlgorithm6: raptorMeatTOResponse.algorithmDurations[6],
                        raptorMeatTBAlgorithm7: raptorMeatTOResponse.algorithmDurations[7],
                        raptorMeatTBAlgorithm8: raptorMeatTOResponse.algorithmDurations[8],
                        raptorMeatTBAlgorithm9: raptorMeatTOResponse.algorithmDurations[9],
                        raptorMeatTBAlgorithm10: raptorMeatTOResponse.algorithmDurations[10],
                        }
                    csvData.push(data);
                }
                await csvWriter.writeRecords(csvData).then(() => console.log('The csv file was written successfully'));
            }
        }    
    }

    /**
     * Creates random requests and compares the results of Raptor Meat and CSA Meat. Calculates the average time of both algorithms.
     */
     private static async performApproximationTestsAndSafeInCSV() {
        let requests: RequestInfo[] = [];

        let alphas = [1, 2, 3];

        let numberOfFilesPerAlpha = 20;
        let numberOfRequestsPerFile = 50;

        requests = await this.importRequests(numberOfFilesPerAlpha);

        for(let alpha of alphas){
            console.log('Alpha = ' + alpha + ':')
            for(let j = 0; j < numberOfFilesPerAlpha; j++){
                const csvWriter = createCsvWriter({
                    path: path.join('test_data', 'approx_dm1_alpha' + alpha + 'v' + j + '.csv'),
                    header: [
                        {id: 'sourceStop', title: 'Source Stop'},
                        {id: 'targetStop', title: 'Target Stop'},
                        {id: 'sourceTime', title: 'Source Time'},
                        {id: 'sourceDate', title: 'Source Date'},
                        {id: 'meat', title: 'MEAT'},
                        {id: 'approxMeat', title: 'Approximated MEAT'}
                    ]
                })
                const csvData = [];
    
                let randomSourceStop: number;
                let randomSourceStopName: string;
                let randomTargetStop: number;
                let randomTargetStopName: string;
                let randomSourceTime: number;
                let randomSourceDate: Date;
                for(let i = 0; i < numberOfRequestsPerFile; i++){
                    randomSourceStop = requests[i + j*numberOfRequestsPerFile].sourceStop;
                    randomTargetStop = requests[i + j*numberOfRequestsPerFile].targetStop;
                    randomSourceTime = requests[i + j*numberOfRequestsPerFile].sourceTime;
                    randomSourceDate = requests[i + j*numberOfRequestsPerFile].sourceDate;
                    randomSourceStopName = GoogleTransitData.STOPS[randomSourceStop].name;
                    randomTargetStopName = GoogleTransitData.STOPS[randomTargetStop].name;
                    
                    let raptorMeatResponse = undefined;
                    let approximatedResultRaptor = undefined;
                    try{
                        raptorMeatResponse = RaptorMeatAlgorithmController.testRaptorMeatAlgorithm(randomSourceStopName, randomTargetStopName, Converter.secondsToTime(randomSourceTime), randomSourceDate, alpha);
                        if(!raptorMeatResponse){
                            throw new Error();
                        }
                        approximatedResultRaptor = ApproximationTestController.performApproximationTestForRaptorMeatAlgorithmWithGivenExpectedArrivalTimes(randomSourceStop, randomTargetStop, raptorMeatResponse.expectedArrivalTimes, 10000000);
                        if(!approximatedResultRaptor){
                            throw new Error();
                        }
                    } catch(error){
                        continue;
                    }
                    const data = {
                        sourceStop: randomSourceStopName,
                        targetStop: randomTargetStopName,
                        sourceTime: randomSourceTime,
                        sourceDate: randomSourceDate.toLocaleDateString('de-DE'),
                        meat: raptorMeatResponse.expectedArrivalTime,
                        approxMeat: approximatedResultRaptor
                    }
                    csvData.push(data);
                }
                await csvWriter.writeRecords(csvData).then(() => console.log('The csv file was written successfully'));
            }
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