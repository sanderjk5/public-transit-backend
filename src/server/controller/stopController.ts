import express from 'express';
import { GoogleTransitData } from '../../data/google-transit-data';
export class StopController {
    public static getMatchingStops(req: express.Request, res: express.Response){
        try {
            if(req.query && req.query.name && req.query.limit){
                const limit: Number = Number(req.query.limit)
                const searchName = req.query.name.toString().toLowerCase();
                const matchingStopNames: string[] = [];
                for(let stop of GoogleTransitData.STOPS){
                    if(matchingStopNames.length - 1 >= limit) {
                        break;
                    }
                    const stopName = stop.name.toLowerCase();
                    if(stopName.includes(searchName) && !matchingStopNames.includes(stop.name)){
                        matchingStopNames.push(stop.name);
                    }
                }
                res.send(matchingStopNames);
            }
            else{
                res.status(400).send();
            }
        }
        catch (err) {
            res.status(500).send(err);
        }
    }
}