import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Sorter } from "../../data/sorter";
import { DecisionGraph } from "../../models/DecisionGraph";
import { Link } from "../../models/Link";
import {Node} from "../../models/Node";
import { Cluster } from "../../models/Cluster";
import { TempEdge } from "../../models/TempEdge";
import { TempNode } from "../../models/TempNode";
import { cloneDeep } from "lodash";

export class DecisionGraphController {

    /**
     * Uses the information of the expanded temp edges to create an expanded and compact decision graph.
     * @param expandedTempEdges 
     * @param arrivalTimesPerStop 
     * @param sourceStop 
     * @param targetStop 
     * @returns 
     */
    public static getDecisionGraphs(expandedTempEdges: TempEdge[], arrivalTimesPerStop: Map<string, number[]>, sourceStop: number, targetStop: number){
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
        expandedTempEdges = this.getDepartureTimesOfFootpaths(arrivalTimesPerStop, expandedTempEdges);
        // sorts the edges and eliminates duplicates
        expandedTempEdges.sort((a: TempEdge, b: TempEdge) => {
            return Sorter.sortEdgesByDepartureTime(a, b);
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
            return Sorter.sortNodesByTime(a, b);
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
        let compactTempEdges: TempEdge[] = this.getCompactTempEdges(expandedTempEdges);
        let arrivalTimeStringOfTarget = this.getArrivalTimeArrayOfTargetStop(expandedTempEdges, targetStop);
        let arrivalStops = new Map<string, string>();
        let departureNode: Node;
        for(let compactTempEdge of compactTempEdges){
            if(compactTempEdge.departureStop === GoogleTransitData.STOPS[sourceStop].name){
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
                if(compactTempEdge.arrivalStop === GoogleTransitData.STOPS[targetStop].name){
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
        const decisionGraphs = {
            expandedDecisionGraph: expandedDecisionGraph,
            compactDecisionGraph: compactDecisionGraph,
        }
        return decisionGraphs;
    }

    /**
     * Gets all departure times of the footpaths.
     * @param arrivalTimesPerStop 
     * @param expandedTempEdges 
     * @returns 
     */
    private static getDepartureTimesOfFootpaths(arrivalTimesPerStop: Map<string, number[]>, expandedTempEdges: TempEdge[]){
        expandedTempEdges.sort((a, b) => {
            return Sorter.sortEdgesByDepartureStopAndDepartureTime(a, b);
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

    /**
     * Get the edges of the compact graph.
     * @param expandedTempEdges 
     * @returns 
     */
    private static getCompactTempEdges(expandedTempEdges: TempEdge[]){
        let compactTempEdges = [];
        if(expandedTempEdges.length === 0){
            return compactTempEdges;
        }
        let expandedTempEdgesCopy = expandedTempEdges;
        expandedTempEdgesCopy.sort((a, b) => {
            return Sorter.sortEdgesByDepartureStop(a, b);
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
            return Sorter.sortEdgesByDepartureTime(a, b);
        })
        return compactTempEdges;
    }

    /**
     * Gets all arrival times of the target stop.
     * @param expandedTempEdges 
     * @param targetStop 
     * @returns 
     */
    private static getArrivalTimeArrayOfTargetStop(expandedTempEdges: TempEdge[], targetStop: number){
        if(expandedTempEdges.length === 0){
            return '';
        }
        let earliestArrivalTime = Number.MAX_VALUE;
        let latestArrivalTime = 0;
        for(let tempEdge of expandedTempEdges){
            if(tempEdge.arrivalStop === GoogleTransitData.STOPS[targetStop].name){
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