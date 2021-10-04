import express from "express";
import { Converter } from "../../data/converter";
import { GoogleTransitData } from "../../data/google-transit-data";
import { Searcher } from "../../data/searcher";
import { JourneyResponse } from "../../models/JourneyResponse";
import { Section } from "../../models/Section";

interface SEntry {
    departureTime: number,
    arrivalTime: number,
    lEnter?: number,
    lExit?: number,
    transferFootpath?: number,
}

interface TEntry {
    arrivalTime: number,
    connectionId?: number,
}

export class ProfileConnectionScanAlgorithmController {
    private static s: SEntry[][];
    private static t: TEntry[];
    private static d: number[];
    private static sourceStop: number;
    private static targetStop: number;
    private static minDepartureTime: number;
    private static maxArrivalTime: number;
    private static sourceDate: Date;

    public static profileConnectionScanAlgorithm(req: express.Request, res: express.Response){
        try {
            // checks the parameters of the http request
            if(!req.query || !req.query.sourceStop || !req.query.targetStop || !req.query.sourceTime || !req.query.date ||
                typeof req.query.sourceStop !== 'string' || typeof req.query.targetStop !== 'string' || typeof req.query.sourceTime !== 'string' || typeof req.query.date !== 'string'){
                res.status(400).send();
                return;
            }
            // gets the source and target stops
            this.sourceStop = GoogleTransitData.getStopIdByName(req.query.sourceStop);
            this.targetStop = GoogleTransitData.getStopIdByName(req.query.targetStop);
            // converts the source time
            this.minDepartureTime = Converter.timeToSeconds(req.query.sourceTime);
            this.maxArrivalTime = Converter.timeToSeconds('23:59:59');
            this.sourceDate = new Date(req.query.date);
            // initializes the csa algorithm
            this.init();
            // calls the csa
            console.time('connection scan profile algorithm')
            this.performAlgorithm();
            console.timeEnd('connection scan profile algorithm')
            // generates the http response which includes all information of the journey
            const journeyResponse = this.getJourney();
            res.send(journeyResponse);
        } catch(error) {
            console.log(error)
            console.timeEnd('connection scan algorithm')
            res.status(500).send(error);
        }
    }

    public static performAlgorithm() {
        let lastConnectionIndex = Searcher.binarySearchOfConnections(this.maxArrivalTime) - 1;
        let firstConnectionIndex = Searcher.binarySearchOfConnections(this.minDepartureTime);
        for(let i = lastConnectionIndex; i >= firstConnectionIndex; i--){
            let currentConnection = GoogleTransitData.CONNECTIONS[i];
            let time1: number;
            let time2: number;
            let time3: number;
            let timeC: number;
            let p: SEntry;
            if(this.d[currentConnection.arrivalStop] !== Number.MAX_VALUE) {
                time1 = currentConnection.arrivalTime + this.d[currentConnection.arrivalStop];
            } else {
                time1 = Number.MAX_VALUE;
            }
            time2 = this.t[currentConnection.trip].arrivalTime;
            let j = 0;
            p = this.s[currentConnection.arrivalStop][j];
            while(p.departureTime < currentConnection.arrivalTime) {
                j++;
                p = this.s[currentConnection.arrivalStop][j];
            }
            time3 = p.arrivalTime;

            timeC = Math.min(time1, time2, time3);

            p = {
                departureTime: currentConnection.departureTime,
                arrivalTime: timeC,
                lEnter: currentConnection.id,
                lExit: this.t[currentConnection.trip].connectionId,
            }

            if(currentConnection.arrivalStop === this.targetStop && time1 === timeC) {
                p.lExit = currentConnection.id;
            }
            
            if(p.lExit !== undefined && p.arrivalTime !== Number.MAX_VALUE && this.notDominatedInProfile(p, currentConnection.departureStop)) {
                let footpaths = GoogleTransitData.getAllFootpathsOfAArrivalStop(currentConnection.departureStop);
                for(let footpath of footpaths) {
                    let pNew: SEntry= {
                        departureTime: currentConnection.departureTime - footpath.duration,
                        arrivalTime: p.arrivalTime,
                        lEnter: p.lEnter,
                        lExit: p.lExit,
                        transferFootpath: footpath.idArrival,
                    }
                    if(this.notDominatedInProfile(pNew, footpath.departureStop)){
                        let shiftedPairs = [];
                        let currentPair = this.s[footpath.departureStop][0];
                        while(pNew.departureTime >= currentPair.departureTime){
                            let removedPair = this.s[footpath.departureStop].shift()
                            shiftedPairs.push(removedPair);
                            currentPair = this.s[footpath.departureStop][0];
                        }
                        this.s[footpath.departureStop].unshift(pNew);
                        for(let j = 0; j < shiftedPairs.length; j++) {
                            let removedPair = shiftedPairs[j];
                            if(!this.dominates(pNew, removedPair)){
                                this.s[footpath.departureStop].unshift(removedPair);
                            }
                        }
                    }
                    
                }
            }
            if(timeC !== Number.MAX_VALUE && timeC < this.t[currentConnection.trip].arrivalTime){
                this.t[currentConnection.trip] = {
                    arrivalTime: timeC,
                    connectionId: currentConnection.id,
                };
            }
        }
        this.getJourney();
    }

    public static init(){
        this.s = new Array(GoogleTransitData.STOPS.length);
        this.t = new Array(GoogleTransitData.TRIPS.length);
        this.d = new Array(GoogleTransitData.STOPS.length);

        const defaultSEntry: SEntry = {
            departureTime: Number.MAX_VALUE,
            arrivalTime: Number.MAX_VALUE,
        }
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++) {
            this.s[i] = [defaultSEntry];
            this.d[i] = Number.MAX_VALUE;
        }
        for(let i = 0; i < this.t.length; i++) {
            this.t[i] = {
                arrivalTime: Number.MAX_VALUE
            };
        }
        
        let finalFootpaths = GoogleTransitData.getAllFootpathsOfAArrivalStop(this.targetStop);
        for(let footpath of finalFootpaths){
            this.d[footpath.departureStop] = footpath.duration;
        }
    }

    private static dominates(q: SEntry, p: SEntry): boolean {
        if(q.arrivalTime < p.arrivalTime) {
            return true;
        }
        if(q.arrivalTime === p.arrivalTime && q.departureTime > p.departureTime) {
            return true;
        }
        return false;
    }

    private static notDominatedInProfile(p: SEntry, stopId: number): boolean{
        for(let q of this.s[stopId]){
            if(this.dominates(q, p)){
                return false;
            }
        }
        return true;
    }

    private static getJourney(): JourneyResponse {
        const sections: Section[] = [];
        let s = this.sourceStop;
        let timeS = this.minDepartureTime;
        let foundFinalFootpath = false;
        let trainSectionCounter = 0;
        while(s !== this.targetStop){
            for(let i = 0; i < this.s[s].length; i++) {
                let p = this.s[s][i];
                if(p.departureTime >= timeS){
                    if(this.d[s] + timeS <= p.arrivalTime){
                        const finalFootpathSection: Section = {
                            departureTime: Converter.secondsToTime(timeS),
                            arrivalTime: Converter.secondsToTime(timeS + this.d[s]),
                            duration: Converter.secondsToTime(this.d[s]),
                            departureStop: GoogleTransitData.STOPS[s].name,
                            arrivalStop: GoogleTransitData.STOPS[this.targetStop].name,
                            type: 'Footpath',
                        }
                        sections.push(finalFootpathSection);
                        foundFinalFootpath = true;
                        break;
                    }
                    const lEnter = GoogleTransitData.CONNECTIONS[p.lEnter];
                    const lExit = GoogleTransitData.CONNECTIONS[p.lExit];
                    if(GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].departureStop !== this.sourceStop || GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].arrivalStop !== this.sourceStop){
                        const footpathSection: Section = {
                            departureTime: Converter.secondsToTime(timeS),
                            arrivalTime: Converter.secondsToTime(timeS + GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].duration),
                            duration: Converter.secondsToTime(GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].duration),
                            departureStop: GoogleTransitData.STOPS[GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].departureStop].name,
                            arrivalStop: GoogleTransitData.STOPS[GoogleTransitData.FOOTPATHS_SORTED_BY_ARRIVAL_STOP[p.transferFootpath].arrivalStop].name,
                            type: 'Footpath',
                        }
                        sections.push(footpathSection);
                    }
                    const trainSection: Section = {
                        departureTime: Converter.secondsToTime(lEnter.departureTime),
                        arrivalTime: Converter.secondsToTime(lExit.arrivalTime),
                        duration: Converter.secondsToTime(lExit.arrivalTime - lEnter.departureTime),
                        departureStop: GoogleTransitData.STOPS[lEnter.departureStop].name,
                        arrivalStop: GoogleTransitData.STOPS[lExit.arrivalStop].name,
                        type: 'Train',
                    }
                    sections.push(trainSection);
                    trainSectionCounter++;
                    s = lExit.arrivalStop;
                    timeS = lExit.arrivalTime;
                    break;
                }
            }
            if(foundFinalFootpath){
                break;
            }
        }
        const journeyResponse: JourneyResponse = {
            departureTime: sections[0].departureTime,
            arrivalTime: sections[sections.length-1].arrivalTime,
            departureDate: this.sourceDate.toLocaleDateString('de-DE'),
            arrivalDate: this.sourceDate.toLocaleDateString('de-DE'),
            changes: Math.max(0, trainSectionCounter - 1),
            sourceStop: GoogleTransitData.STOPS[this.sourceStop].name,
            targetStop: GoogleTransitData.STOPS[this.targetStop].name,
            sections: sections,
        }
        return journeyResponse;
    }
}