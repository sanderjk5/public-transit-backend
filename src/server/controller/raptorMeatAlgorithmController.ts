import express from "express";
import { ParsedQs } from "qs";
import { Calculator } from "../../data/calculator";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { ConnectionScanAlgorithmController } from "./connectionScanAlgorithmController";
import FastPriorityQueue from 'fastpriorityqueue';
import { RaptorAlgorithmController } from "./raptorAlgorithmController";
import { MeatResponse } from "../../models/MeatResponse";
import { DecisionGraph } from "../../models/DecisionGraph";
import { TempNode } from "../../models/TempNode";
import { TempEdge } from "../../models/TempEdge";
import { MAX_D_C_LONG, MAX_D_C_NORMAL } from "../../constants";
import { Link } from "../../models/Link";
import {Node} from "../../models/Node";
import { Cluster } from "../../models/Cluster";
import { Reliability } from "../../data/reliability";
import { McRaptorAlgorithmController } from "./mcRaptorAlgorithmController";

interface BackupInfo {
    departureStops: number[],
    arrivalTime: number,
    lastDepartureTime: number,
    safeTime: number,
    probability: number,
    isLongDistance: boolean,
}

interface TargetStopInfo {
    arrivalTime: number,
    probability: number,
}
export class RaptorMeatAlgorithmController {
    private static sourceStops: number[];
    private static targetStops: number[];

    private static minDepartureTime: number;
    private static earliestArrivalTime: number;
    private static earliestSafeArrivalTime: number;
    private static maxArrivalTime: number;

    private static sourceWeekday: number;
    private static sourceDate: Date;

    private static targetStopInfos: TargetStopInfo[];

    public static raptorMeatAlgorithm(req: express.Request, res: express.Response) {
        try {
            // checks the parameters of the http request
            if(!req.query || !req.query.sourceStop || !req.query.targetStop || !req.query.sourceTime ||  !req.query.date ||
                typeof req.query.sourceStop !== 'string' || typeof req.query.targetStop !== 'string' || typeof req.query.sourceTime !== 'string' || typeof req.query.date !== 'string'){
                res.status(400).send();
                return;
            }
            // gets the source and target stops
            this.sourceStops = GoogleTransitData.getStopIdsByName(req.query.sourceStop);
            this.targetStops = GoogleTransitData.getStopIdsByName(req.query.targetStop);
            // converts the source time
            this.minDepartureTime = Converter.timeToSeconds(req.query.sourceTime);
            this.sourceDate = new Date(req.query.date);
            this.sourceWeekday = Calculator.moduloSeven((this.sourceDate.getDay() - 1));

            this.earliestArrivalTime = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, false);
            this.earliestSafeArrivalTime = ConnectionScanAlgorithmController.getEarliestArrivalTime(req.query.sourceStop, req.query.targetStop, this.sourceDate, this.minDepartureTime, true);
            if(this.earliestArrivalTime === null || this.earliestSafeArrivalTime === null) {
                throw new Error("Couldn't find a connection.")
            }

            // calculates the maximum arrival time of the alpha bounded version of the algorithm
            this.maxArrivalTime = this.earliestSafeArrivalTime + 0.5 * (this.earliestSafeArrivalTime - this.minDepartureTime);

            // initializes the raptor algorithm
            this.init();
            console.time('raptor meat algorithm')
            // calls the raptor
            let meatResponse = this.performAlgorithm();
            console.timeEnd('raptor meat algorithm')
            //McRaptorAlgorithmController.getJourneyPointersOfRaptorAlgorithm(this.sourceStops, this.targetStops, this.sourceDate, this.minDepartureTime, this.maxArrivalTime);
            // generates the http response which includes all information of the journey
            res.status(200).send(meatResponse);
        } catch (err) {
            console.log(err);
            res.status(500).send(err);
        }
    }

    private static performAlgorithm(){
        let tempEdges: TempEdge[] = [];
        let arrivalTimesPerStop: Map<string, number[]> = new Map<string, number[]>();
        let priorityQueue = new FastPriorityQueue<BackupInfo>((a, b) => {
            if(a.lastDepartureTime === b.lastDepartureTime){
                return GoogleTransitData.STOPS[a.departureStops[0]].name < GoogleTransitData.STOPS[b.departureStops[0]].name
            } else {
                return a.lastDepartureTime < b.lastDepartureTime
            }
        });
        let journeyPointers = RaptorAlgorithmController.getJourneyPointersOfRaptorAlgorithm(this.sourceStops, this.targetStops, this.sourceDate, this.minDepartureTime);

        let probability = 1;

        let lastArrivalTime = null;
        let lastArrivalStop = null;
        let isLastTripLongDistance = null;
        let lastMaxDelay = null;
        for(let journeyPointer of journeyPointers){
            let departureTime = journeyPointer.departureTime;
            let arrivalTime = journeyPointer.arrivalTime;
            let departureStop = journeyPointer.enterTripAtStop;
            let arrivalStop = journeyPointer.exitTripAtStop;
            let tripId = journeyPointer.tripId;

            let tempEdge: TempEdge = {
                departureStop: GoogleTransitData.STOPS[departureStop].name,
                arrivalStop: GoogleTransitData.STOPS[arrivalStop].name,
                departureTime: departureTime,
                arrivalTime: arrivalTime,
                type: 'Train',
            }
            tempEdges.push(tempEdge);

            if(arrivalTimesPerStop.get(tempEdge.arrivalStop) === undefined) {
                arrivalTimesPerStop.set(tempEdge.arrivalStop, [tempEdge.arrivalTime]);
            } else {
                arrivalTimesPerStop.get(tempEdge.arrivalStop).push(tempEdge.arrivalTime);
            }

            if(lastArrivalTime !== null && lastMaxDelay !== null){
                if(lastArrivalTime + lastMaxDelay >= departureTime){
                    const backUpInfo: BackupInfo = {
                        departureStops: [lastArrivalStop],
                        arrivalTime: lastArrivalTime,
                        lastDepartureTime: departureTime,
                        safeTime: lastArrivalTime + lastMaxDelay,
                        probability: probability * (1 - Reliability.getReliability(-1, departureTime - lastArrivalTime, isLastTripLongDistance)),
                        isLongDistance: isLastTripLongDistance,
                    }
                    priorityQueue.add(backUpInfo);
                }
                probability = probability * Reliability.getReliability(-1, departureTime - lastArrivalTime, isLastTripLongDistance);
            }
            lastArrivalStop = arrivalStop;
            lastArrivalTime = arrivalTime;
            lastMaxDelay = MAX_D_C_NORMAL;
            isLastTripLongDistance = false;
            if(GoogleTransitData.TRIPS[tripId].isLongDistance){
                lastMaxDelay = MAX_D_C_LONG;
                isLastTripLongDistance = true;
            }
            if(this.targetStops.includes(arrivalStop)){
                let expectedDelay = Reliability.normalDistanceExpectedValue;
                if(isLastTripLongDistance){
                    expectedDelay = Reliability.longDistanceExpectedValue;
                }
                const targetStopInfo: TargetStopInfo = {
                    arrivalTime: arrivalTime + expectedDelay,
                    probability: probability,
                }
                this.targetStopInfos.push(targetStopInfo);
            }
        }
        while(!priorityQueue.isEmpty()){
            let backUpInfo = priorityQueue.poll();
            let nextBackInfo = priorityQueue.peek();
            while(nextBackInfo && backUpInfo.lastDepartureTime === nextBackInfo.lastDepartureTime && GoogleTransitData.STOPS[backUpInfo.departureStops[0]].name === GoogleTransitData.STOPS[nextBackInfo.departureStops[0]].name){
                priorityQueue.poll();
                backUpInfo.probability += nextBackInfo.probability;
                nextBackInfo = priorityQueue.peek();
            }
            let journeyPointers = RaptorAlgorithmController.getJourneyPointersOfRaptorAlgorithm(backUpInfo.departureStops, this.targetStops, this.sourceDate, backUpInfo.lastDepartureTime+0.1);
            probability = backUpInfo.probability;
            if(journeyPointers[0].departureTime <= backUpInfo.safeTime){
                let updatedBackupInfo: BackupInfo = {
                    departureStops: backUpInfo.departureStops,
                    arrivalTime: backUpInfo.arrivalTime,
                    lastDepartureTime: journeyPointers[0].departureTime,
                    safeTime: backUpInfo.safeTime,
                    probability: probability * (1 - Reliability.getReliability(-1, journeyPointers[0].departureTime - backUpInfo.arrivalTime, backUpInfo.isLongDistance)),
                    isLongDistance: backUpInfo.isLongDistance,
                }
                priorityQueue.add(updatedBackupInfo);
            }
            probability = probability * Reliability.getReliability(-1, journeyPointers[0].departureTime - backUpInfo.arrivalTime, backUpInfo.isLongDistance);
            let lastArrivalTime = null;
            let lastArrivalStop = null;
            let lastMaxDelay = null;
            let isLastTripLongDistance = null;
            for(let journeyPointer of journeyPointers){
                let departureTime = journeyPointer.departureTime;
                let arrivalTime = journeyPointer.arrivalTime;
                let departureStop = journeyPointer.enterTripAtStop;
                let arrivalStop = journeyPointer.exitTripAtStop;
                let tripId = journeyPointer.tripId;
    
                let tempEdge: TempEdge = {
                    departureStop: GoogleTransitData.STOPS[departureStop].name,
                    arrivalStop: GoogleTransitData.STOPS[arrivalStop].name,
                    departureTime: departureTime,
                    arrivalTime: arrivalTime,
                    type: 'Train',
                }
                tempEdges.push(tempEdge);
                if(arrivalTimesPerStop.get(tempEdge.arrivalStop) === undefined) {
                    arrivalTimesPerStop.set(tempEdge.arrivalStop, [tempEdge.arrivalTime]);
                } else {
                    arrivalTimesPerStop.get(tempEdge.arrivalStop).push(tempEdge.arrivalTime);
                }
    
                if(lastArrivalTime !== null && lastMaxDelay !== null){
                    if(lastArrivalTime + lastMaxDelay >= departureTime){
                        const backUpInfo: BackupInfo = {
                            departureStops: [lastArrivalStop],
                            arrivalTime: lastArrivalTime,
                            lastDepartureTime: departureTime,
                            safeTime: lastArrivalTime + lastMaxDelay,
                            probability: probability * (1 - Reliability.getReliability(-1, departureTime - lastArrivalTime, isLastTripLongDistance)),
                            isLongDistance: isLastTripLongDistance,
                        }
                        priorityQueue.add(backUpInfo);
                    }
                    probability = probability * Reliability.getReliability(-1, departureTime - lastArrivalTime, isLastTripLongDistance);
                }
                lastArrivalStop = arrivalStop;
                lastArrivalTime = arrivalTime;
                lastMaxDelay = MAX_D_C_NORMAL;
                isLastTripLongDistance = false;
                if(GoogleTransitData.TRIPS[tripId].isLongDistance){
                    lastMaxDelay = MAX_D_C_LONG;
                    isLastTripLongDistance = true;
                }
                if(this.targetStops.includes(arrivalStop)){
                    let expectedDelay = Reliability.normalDistanceExpectedValue;
                    if(isLastTripLongDistance){
                        expectedDelay = Reliability.longDistanceExpectedValue;
                    }
                    const targetStopInfo: TargetStopInfo = {
                        arrivalTime: arrivalTime + expectedDelay,
                        probability: probability,
                    }
                    this.targetStopInfos.push(targetStopInfo);
                }
            }
        }
        return this.getMeatResponse(tempEdges, arrivalTimesPerStop);
    }

    private static getMeatResponse(expandedTempEdges: TempEdge[], arrivalTimesPerStop: Map<string, number[]>) {
        // sets the common values of the journey
        let meatResponse: MeatResponse = {
            sourceStop: GoogleTransitData.STOPS[this.sourceStops[0]].name,
            targetStop: GoogleTransitData.STOPS[this.targetStops[0]].name,
            meatTime: Converter.secondsToTime(this.calculateMeat()),
            eatTime: Converter.secondsToTime(this.earliestArrivalTime),
            esatTime: Converter.secondsToTime(this.earliestSafeArrivalTime),
            expandedDecisionGraph: {
                nodes: [],
                links: [],
                clusters: [],
            },
            compactDecisionGraph: {
                nodes: [],
                links: [],
                clusters: [],
            }
        }
        let expandedDecisionGraph: DecisionGraph = {
            nodes: [],
            links: [],
            clusters: [],
        };     
        let compactDecisionGraph: DecisionGraph = {
            nodes: [],
            links: [],
            clusters: [],
        }
        let idCounter = 0;
        let tempNodes: TempNode[] = [];
        let tempNodeArr: TempNode;
        let tempNodeDep: TempNode;
        let edge: Link;
        //expandedTempEdges = this.getDepartureTimesOfFootpaths(arrivalTimesPerStop, expandedTempEdges);
        // sorts the edges and eliminates duplicates
        expandedTempEdges.sort((a: TempEdge, b: TempEdge) => {
            return this.sortByDepartureTime(a, b);
        })
        expandedTempEdges = this.removeDuplicateEdges(expandedTempEdges);
        // uses the temp edges to create temp nodes and edges
        for(let tempEdge of expandedTempEdges){
            tempNodeDep = {
                id: 'id_' + idCounter.toString(),
                stop: tempEdge.departureStop,
                time: tempEdge.departureTime,
                type: 'departure',
            }
            tempNodes.push(tempNodeDep);
            idCounter++;
            tempNodeArr = {
                id: 'id_' + idCounter.toString(),
                stop: tempEdge.arrivalStop,
                time: tempEdge.arrivalTime,
                type: 'arrival',
            }
            tempNodes.push(tempNodeArr);
            idCounter++;
            edge = {
                id: 'id_' + idCounter.toString(),
                source: tempNodeDep.id,
                target: tempNodeArr.id,
                label: tempEdge.type,
            }
            expandedDecisionGraph.links.push(edge);
            idCounter++;
        }
        // sorts nodes and eliminates duplicates
        tempNodes.sort((a: TempNode, b: TempNode) => {
            return this.sortByTime(a, b);
        })
        tempNodes = this.removeDuplicateNodes(tempNodes, expandedDecisionGraph.links);
        let node: Node;
        let cluster: Cluster;
        // uses the temp nodes to create nodes and clusters
        for(let tempNode of tempNodes){
            node = {
                id: tempNode.id,
                label: Converter.secondsToTime(tempNode.time)
            }
            expandedDecisionGraph.nodes.push(node);
            let createCluster = true;
            for(let cluster of expandedDecisionGraph.clusters){
                if(cluster.label === tempNode.stop){
                    createCluster = false;
                    cluster.childNodeIds.push(node.id);
                    break;
                }
            }
            if(createCluster){
                cluster = {
                    id: 'id_' + idCounter.toString(),
                    label: tempNode.stop,
                    childNodeIds: [node.id],
                }
                expandedDecisionGraph.clusters.push(cluster);
                idCounter++;
            }
        }
        meatResponse.expandedDecisionGraph = expandedDecisionGraph;
        let compactTempEdges: TempEdge[] = this.getCompactTempEdges(expandedTempEdges);
        let arrivalTimeStringOfTarget = this.getArrivalTimeArrayOfTargetStop(expandedTempEdges);
        let arrivalStops = new Map<string, string>();
        let departureNode: Node;
        for(let compactTempEdge of compactTempEdges){
            if(compactTempEdge.departureStop === GoogleTransitData.STOPS[this.sourceStops[0]].name){
                cluster = {
                    id: 'id_' + idCounter.toString(),
                    label: compactTempEdge.departureStop,
                    childNodeIds: [],
                }
                compactDecisionGraph.clusters.push(cluster);
                idCounter++;
            }
            departureNode = {
                id: 'id_' + idCounter.toString(),
                label: Converter.secondsToTime(compactTempEdge.departureTime), 
            }
            if(compactTempEdge.lastDepartureTime !== undefined){
                departureNode.label = departureNode.label + ' - ' + Converter.secondsToTime(compactTempEdge.lastDepartureTime);
            }
            compactDecisionGraph.nodes.push(departureNode);
            idCounter++;
            for(let cluster of compactDecisionGraph.clusters){
                if(cluster.label === compactTempEdge.departureStop){
                    cluster.childNodeIds.push(departureNode.id);
                    break;
                }
            }
            if(arrivalStops.get(compactTempEdge.arrivalStop) === undefined){
                node = {
                    id: 'id_' + idCounter.toString(),
                    label: ' ',
                }
                if(compactTempEdge.arrivalStop === GoogleTransitData.STOPS[this.targetStops[0]].name){
                    node.label = arrivalTimeStringOfTarget;
                }
                compactDecisionGraph.nodes.push(node);
                arrivalStops.set(compactTempEdge.arrivalStop, node.id);
                idCounter++;
                cluster = {
                    id: 'id_' + idCounter.toString(),
                    label: compactTempEdge.arrivalStop,
                    childNodeIds: [node.id],
                }
                compactDecisionGraph.clusters.push(cluster);
                idCounter++;
            }
            edge = {
                id: 'id_' + idCounter.toString(),
                source: departureNode.id,
                target: arrivalStops.get(compactTempEdge.arrivalStop),
                label: compactTempEdge.type,
            }
            compactDecisionGraph.links.push(edge);
            idCounter++;
        }
        meatResponse.compactDecisionGraph = compactDecisionGraph;
        return meatResponse;
    }

    private static calculateMeat(){
        let meat = 0;
        let probabilitySum = 0;
        for(let targetStopInfo of this.targetStopInfos){
            meat += (targetStopInfo.arrivalTime * targetStopInfo.probability)
            probabilitySum += targetStopInfo.probability;
        }
        console.log(probabilitySum);
        console.log(meat);
        return meat;
    }

    private static init() {
        this.targetStopInfos = [];
    }

    /**
     * Sorts temp edges by departure time, arrival time, source stop, target stop and type.
     * @param a 
     * @param b 
     * @returns 
     */
     private static sortByDepartureTime(a: TempEdge, b: TempEdge){
        if(a.departureTime < b.departureTime){
            return -1;
        }
        if(a.departureTime === b.departureTime){
            if(a.arrivalTime < b.arrivalTime){
                return -1;
            }
            if(a.arrivalTime === b.arrivalTime){
                if(a.departureStop < b.departureStop){
                    return -1;
                }
                if(a.departureStop === b.departureStop){
                    if(a.arrivalStop < b.arrivalStop){
                        return -1;
                    }
                    if(a.arrivalStop === b.arrivalStop){
                        if(a.type < b.type){
                            return -1;
                        }
                        if(a.type === b.type){
                            return 0;
                        }
                        if(a.type > b.type){
                            return 1;
                        }
                    }
                    if(a.arrivalStop > b.arrivalStop){
                        return 1;
                    }
                }
                if(a.departureStop > b.departureStop){
                    return 1;
                }
            }
            if(a.arrivalTime > b.arrivalTime){
                return 1;
            }
        }
        if(a.departureTime > b.departureTime){
            return 1
        }
    }

    /**
     * Sorts temp edges by source stop, target stop, type and departure time.
     * @param a 
     * @param b 
     * @returns 
     */
     private static sortByDepartureStop(a: TempEdge, b: TempEdge){
        if(a.departureStop < b.departureStop){
            return -1;
        }
        if(a.departureStop === b.departureStop){
            if(a.arrivalStop < b.arrivalStop){
                return -1;
            }
            if(a.arrivalStop === b.arrivalStop){
                if(a.type < b.type){
                    return -1;
                }
                if(a.type === b.type){
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
                if(a.type > b.type){
                    return 1;
                }
            }
            if(a.arrivalStop > b.arrivalStop){
                return 1;
            }
        }
        if(a.departureStop > b.departureStop){
            return 1
        }
    }

    private static sortByDepartureStopAndDepartureTime(a: TempEdge, b: TempEdge){
        if(a.departureStop < b.departureStop){
            return -1;
        }
        if(a.departureStop === b.departureStop){
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
        if(a.departureStop > b.departureStop){
            return 1
        }
    }

    /**
     * Sorts tempNodes by time, stop and type.
     * @param a 
     * @param b 
     * @returns 
     */
    private static sortByTime(a: TempNode, b: TempNode){
        if(a.time < b.time){
            return -1;
        }
        if(a.time === b.time){
            if(a.stop < b.stop){
                return -1;
            }
            if(a.stop === b.stop){
                if(a.type < b.type){
                    return -1;
                }
                if(a.type === b.type){
                    return 0;
                }
                if(a.type > b.type){
                    return 1;
                }
            }
            if(a.stop > b.stop){
                return 1;
            }
        }
        if(a.time > b.time){
            return 1;
        }
    }

    private static getDepartureTimesOfFootpaths(arrivalTimesPerStop: Map<string, number[]>, expandedTempEdges: TempEdge[]){
        expandedTempEdges.sort((a, b) => {
            return this.sortByDepartureStopAndDepartureTime(a, b);
        });
        let lastDepartureStop: string = expandedTempEdges[0].departureStop;
        let lastArrivalTimes = arrivalTimesPerStop.get(lastDepartureStop);
        if(lastArrivalTimes !== undefined){
            lastArrivalTimes.push(Number.MAX_VALUE);
            lastArrivalTimes.sort((a, b) => a-b);
        }
        let lastArrivalTimeIndex = 0;
        for(let tempEdge of expandedTempEdges){
            if(tempEdge.departureStop !== lastDepartureStop){
                lastDepartureStop = tempEdge.departureStop;
                lastArrivalTimes = arrivalTimesPerStop.get(lastDepartureStop);
                if(lastArrivalTimes === undefined){
                    continue;
                }
                lastArrivalTimes.push(Number.MAX_VALUE);
                lastArrivalTimes.sort((a, b) => a-b);
                lastArrivalTimeIndex = 1;
            }
            if(tempEdge.type !== 'Footpath'){
                continue;
            }
            while(lastArrivalTimes[lastArrivalTimeIndex] <= tempEdge.departureTime){
                lastArrivalTimeIndex++;
            }
            let duration = tempEdge.arrivalTime - tempEdge.departureTime;
            tempEdge.departureTime = lastArrivalTimes[lastArrivalTimeIndex-1];
            tempEdge.arrivalTime = tempEdge.departureTime + duration;
        }
        return expandedTempEdges;
    }

    /**
     * Removes duplicate edges.
     * @param edges 
     * @returns 
     */
    private static removeDuplicateEdges(edges: TempEdge[]){
        if(edges.length === 0){
            return;
        }
        let lastEdge = edges[0];
        for(let i = 1; i < edges.length; i++){
            let currentEdge = edges[i];
            if(currentEdge.departureStop === lastEdge.departureStop && currentEdge.arrivalStop === lastEdge.arrivalStop && currentEdge.departureTime === lastEdge.departureTime &&
                currentEdge.arrivalTime === lastEdge.arrivalTime && currentEdge.type === lastEdge.type){
                edges[i] = undefined;
            } else {
                lastEdge = edges[i];
            }
        }
        return edges.filter(edge => edge !== undefined);
    }

    private static getCompactTempEdges(expandedTempEdges: TempEdge[]){
        let compactTempEdges = [];
        if(expandedTempEdges.length === 0){
            return compactTempEdges;
        }
        let expandedTempEdgesCopy = expandedTempEdges;
        expandedTempEdgesCopy.sort((a, b) => {
            return this.sortByDepartureStop(a, b);
        });
        let firstDepartureTime = expandedTempEdges[0].departureTime;
        let lastDepartureTime = undefined;
        let currentDepartureStop = expandedTempEdges[0].departureStop;
        let currentArrivalStop = expandedTempEdges[0].arrivalStop;
        let currentType = expandedTempEdges[0].type;
        for(let i = 1; i <= expandedTempEdgesCopy.length; i++){
            let currentTempEdge = expandedTempEdgesCopy[i];
            if(currentTempEdge && currentTempEdge.departureStop === currentDepartureStop && currentTempEdge.arrivalStop === currentArrivalStop && currentTempEdge.type === currentType) {
                lastDepartureTime = currentTempEdge.departureTime;
            } else {
                let newTempEdge: TempEdge = {
                    departureStop: currentDepartureStop,
                    arrivalStop: currentArrivalStop,
                    type: currentType,
                    departureTime: firstDepartureTime,
                    lastDepartureTime: lastDepartureTime,
                }
                compactTempEdges.push(newTempEdge);
                if(currentTempEdge){
                    firstDepartureTime = currentTempEdge.departureTime;
                    lastDepartureTime = undefined;
                    currentDepartureStop = currentTempEdge.departureStop;
                    currentArrivalStop = currentTempEdge.arrivalStop;
                    currentType = currentTempEdge.type;
                }
            }
        }
        compactTempEdges.sort((a, b) => {
            return this.sortByDepartureTime(a, b);
        })
        return compactTempEdges;
    }

    private static getArrivalTimeArrayOfTargetStop(expandedTempEdges: TempEdge[]){
        if(expandedTempEdges.length === 0){
            return '';
        }
        let earliestArrivalTime = Number.MAX_VALUE;
        let latestArrivalTime = 0;
        for(let tempEdge of expandedTempEdges){
            if(tempEdge.arrivalStop === GoogleTransitData.STOPS[this.targetStops[0]].name){
                if(tempEdge.arrivalTime < earliestArrivalTime){
                    earliestArrivalTime = tempEdge.arrivalTime;
                }
                if(tempEdge.arrivalTime > latestArrivalTime){
                    latestArrivalTime = tempEdge.arrivalTime;
                }
            }
        }
        let arrivalTimeString = Converter.secondsToTime(earliestArrivalTime);
        if(earliestArrivalTime < latestArrivalTime){
            arrivalTimeString += ' - ' + Converter.secondsToTime(latestArrivalTime);
        }
        return arrivalTimeString;
    }

    /**
     * Removes duplicate nodes and maps edge ids.
     * @param nodes 
     * @param edges 
     * @returns 
     */
    private static removeDuplicateNodes(nodes: TempNode[], edges: Link[]){
        if(nodes.length === 0){
            return;
        }
        let idMap = new Map<string, string>();
        let lastNode = nodes[0];
        for(let i = 1; i < nodes.length; i++){
            let currentNode = nodes[i];
            if(currentNode.stop === lastNode.stop && currentNode.time === lastNode.time && currentNode.type === lastNode.type){
                idMap.set(currentNode.id, lastNode.id);
                nodes[i] = undefined;
            } else {
                lastNode = nodes[i];
            }
        }
        for(let edge of edges){
            if(idMap.get(edge.source) !== undefined){
                edge.source = idMap.get(edge.source);
            }
            if(idMap.get(edge.target) !== undefined){
                edge.target = idMap.get(edge.target);
            }
        }
        return nodes.filter(node => node !== undefined);
    }

}