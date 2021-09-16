import {readFileSync} from 'fs';
import { GoogleTransitData } from './google-transit-data';
import { Stop  } from '../models/Stop';
import path from 'path'
import { Calendar } from '../models/Calendar';
import { CalendarDate } from '../models/CalendarDates';
import { Route } from '../models/Routes';
import { StopTime } from '../models/StopTime';
import { Trip } from '../models/Trip';
import { Converter } from './converter';
import { Agency } from '../models/Agency';
import { RouteStopMapping } from '../models/RouteStopMapping';
import { Sorter } from './sorter';

export class Importer {

    public static readonly GOOGLE_TRANSIT_FOLDER: string = path.join(__dirname, '../../google_transit');
    private static stopIdMap = new Map<number, number>();
    private static tripIdMap = new Map<number, number>();
    private static routeIdMap = new Map<number, number>();

    public static importGoogleTransitData(): void {
        console.time('import')
        Importer.importAgency();
        Importer.importCalendar();
        Importer.importCalendarDates();
        Importer.importRoutes();
        Importer.importStops();
        Importer.importTrips();
        Importer.importStopTimes();
        Importer.generateValidRoutes();
        //Importer.initializeRoutesServingStops();
        //Importer.initializeAllStopsOfARoute();
        //Importer.analyzeRoutes();
        console.timeEnd('import')
        
    }

    private static importAgency(): void {
        console.time('agency');
        const importedAgency = [];
        const agencyData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_FOLDER, 'agency.txt'), 'utf-8').toString().split('\n');
        for(let i = 1; i < agencyData.length - 1; i++){
            const currentAgencyAsArray: string[] = agencyData[i].split(',');
            const id = Number(currentAgencyAsArray[0]);
            const name = currentAgencyAsArray[1];
            const url = currentAgencyAsArray[2];
            const timezone = currentAgencyAsArray[3]
            const lang = currentAgencyAsArray[4]
            const agency: Agency = {
                id: id,
                name: name,
                url: url,
                timezone: timezone,
                lang: lang
            }
            importedAgency.push(agency);
        }
        GoogleTransitData.AGENCIES = importedAgency;
        console.timeEnd('agency');
    }

    private static importCalendar(): void {
        console.time('calendar');
        const importedCalendar = [];
        const calendarData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_FOLDER, 'calendar.txt'), 'utf-8').toString().split('\n');
        for(let i = 1; i < calendarData.length - 1; i++){
            const currentCalendarAsArray: string[] = calendarData[i].split(',');
            const monday = currentCalendarAsArray[0];
            const tuesday = currentCalendarAsArray[1];
            const wednesday = currentCalendarAsArray[2]
            const thursday = currentCalendarAsArray[3]
            const friday = currentCalendarAsArray[4]
            const saturday = currentCalendarAsArray[5]
            const sunday = currentCalendarAsArray[6]
            const startDate = currentCalendarAsArray[7]
            const endDate = currentCalendarAsArray[8];
            const serviceId = Number(currentCalendarAsArray[9]);
            const calendar: Calendar = {
                serviceId: serviceId,
                monday: monday,
                tuesday: tuesday,
                wednesday: wednesday,
                thursday: thursday,
                friday: friday,
                saturday: saturday,
                sunday: sunday,
                startDate: startDate,
                endDate: endDate
            }
            importedCalendar.push(calendar);
        }
        GoogleTransitData.CALENDAR = importedCalendar;
        console.timeEnd('calendar');
    }

    private static importCalendarDates(): void {
        console.time('calendar dates');
        const importedCalendarDates = [];
        const calendarDatesData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_FOLDER, 'calendar_dates.txt'), 'utf-8').toString().split('\n');
        for(let i = 1; i < calendarDatesData.length - 1; i++){
            const currentCalendarDatesAsArray: string[] = calendarDatesData[i].split(',');
            const serviceId = Number(currentCalendarDatesAsArray[0]);
            const exceptionType = currentCalendarDatesAsArray[1];
            const date = currentCalendarDatesAsArray[2];
            const calendarDate: CalendarDate = {
                serviceId: serviceId,
                date: date,
                exception_type: exceptionType
            }
            importedCalendarDates.push(calendarDate);
        }
        GoogleTransitData.CALENDAR_DATES = importedCalendarDates;
        console.timeEnd('calendar dates');
    }

    private static importRoutes(): void {
        console.time('route');
        const importedRoutes = [];
        const routeData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_FOLDER, 'routes.txt'), 'utf-8').toString().split('\n');
        for(let i = 1; i < routeData.length - 1; i++){
            const currentRouteAsArray: string[] = routeData[i].split(',');
            const id = Number(currentRouteAsArray[4]);
            const agencyId = Number(currentRouteAsArray[2]);
            const shortName = currentRouteAsArray[1];
            const longName = currentRouteAsArray[0];
            const routeType = Number(currentRouteAsArray[3]);
            const route: Route = {
                id: importedRoutes.length,
                agencyId: agencyId,
                shortName: shortName,
                longName: longName,
                routeType: routeType,
            }
            this.routeIdMap.set(id, route.id);
            importedRoutes.push(route);
        }
        GoogleTransitData.ROUTES = importedRoutes;
        console.timeEnd('route');
    }
    
    private static importStops(): void {
        console.time('stops');
        const importedStops = [];
        const stopData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_FOLDER, 'stops.txt'), 'utf-8').toString().split('\n');
        for(let i = 1; i < stopData.length - 1; i++){
            const currentStopAsArray: string[] = stopData[i].split(',');
            const id = Number(currentStopAsArray[1]);
            const name = currentStopAsArray[0];
            const lat = currentStopAsArray[2];
            const lon = currentStopAsArray[3];
            const stop: Stop = {
                id: importedStops.length,
                name: name,
                lat: lat,
                lon: lon
            }
            this.stopIdMap.set(id, stop.id);
            importedStops.push(stop);
        }
        GoogleTransitData.STOPS = importedStops;
        console.timeEnd('stops');
    }

    private static importStopTimes(): void {
        console.time('stop times');
        const importedStopTimes = [];
        const stopTimeData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_FOLDER, 'stop_times.txt'), 'utf-8').toString().split('\n');
        for(let i = 1; i < stopTimeData.length - 1; i++){
            const currentStopTimeAsArray: string[] = stopTimeData[i].split(',');
            const tripId = Number(currentStopTimeAsArray[0]);
            const arrivalTime = currentStopTimeAsArray[1];
            const departureTime = currentStopTimeAsArray[2];
            const stopId = Number(currentStopTimeAsArray[3]);
            const stopSequence = Number(currentStopTimeAsArray[4]);
            const pickupType = currentStopTimeAsArray[5];
            const dropOffType = currentStopTimeAsArray[6];
            const stopTime: StopTime = {
                tripId: this.tripIdMap.get(tripId),
                arrivalTime: Converter.timeToSeconds(arrivalTime),
                departureTime: Converter.timeToSeconds(departureTime),
                stopId: this.stopIdMap.get(stopId),
                stopSequence: stopSequence,
                pickupType: pickupType,
                dropOffType: dropOffType,
            }
            if(stopTime.tripId && stopTime.stopId){
                importedStopTimes.push(stopTime);
            }
        }
        GoogleTransitData.STOPTIMES = importedStopTimes;
        console.timeEnd('stop times');
    }

    private static importTrips(): void {
        console.time('trips');
        const importedTrips = [];
        const tripData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_FOLDER, 'trips.txt'), 'utf-8').toString().split('\n');
        for(let i = 1; i < tripData.length - 1; i++){
            const currentTripAsArray: string[] = tripData[i].split(',');
            const routeId = Number(currentTripAsArray[0]);
            const serviceId = Number(currentTripAsArray[1]);
            const id = Number(currentTripAsArray[3]);
            const directionId = Number(currentTripAsArray[2]);
            const trip: Trip = {
                routeId: this.routeIdMap.get(routeId),
                serviceId: serviceId,
                id: importedTrips.length,
                directionId: directionId,
            }
            if(trip.routeId){
                this.tripIdMap.set(id, trip.id);
                importedTrips.push(trip);
            }
        }
        GoogleTransitData.TRIPS = importedTrips;
        console.timeEnd('trips');
    }

    private static generateValidRoutes(): void {
        const routesCopy = GoogleTransitData.ROUTES;
        GoogleTransitData.ROUTES = [];
        GoogleTransitData.STOPTIMES.sort((a: StopTime, b: StopTime) => {
            return Sorter.sortStopTimesByTripIdAndSequence(a, b);
        })

        GoogleTransitData.STOPTIMESOFATRIP = new Array(GoogleTransitData.TRIPS.length);
        GoogleTransitData.TRIPSOFAROUTE = [];
        GoogleTransitData.ROUTESSERVINGSTOPS = new Array(GoogleTransitData.STOPS.length);
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            GoogleTransitData.ROUTESSERVINGSTOPS[i] = [];
        }

        GoogleTransitData.STOPSOFAROUTE = [];
        
        const routeIdMapping = new Map<string, number>();
        let lastTripId = GoogleTransitData.STOPTIMES[0].tripId;
        let stopIdString = '';
        let stops = [];
        GoogleTransitData.STOPTIMESOFATRIP[GoogleTransitData.STOPTIMES[0].tripId] = 0;
        for(let i = 0; i < GoogleTransitData.STOPTIMES.length; i++){
            let stopTime = GoogleTransitData.STOPTIMES[i];
            if(lastTripId !== stopTime.tripId){
                let newRouteId = routeIdMapping.get(stopIdString)
                if(!newRouteId){
                    let newRoute = routesCopy[GoogleTransitData.TRIPS[lastTripId].routeId];
                    newRouteId = GoogleTransitData.ROUTES.length;
                    newRoute.id = newRouteId;
                    routeIdMapping.set(stopIdString, newRouteId);
                    GoogleTransitData.ROUTES.push(newRoute);
                    GoogleTransitData.STOPSOFAROUTE.push(stops);
                    for(let j = 0; j < stops.length; j++){
                        GoogleTransitData.ROUTESSERVINGSTOPS[stops[j]].push({routeId: newRouteId, stopSequence: j})
                    }
                    GoogleTransitData.TRIPSOFAROUTE.push([lastTripId]);
                } else {
                    GoogleTransitData.TRIPSOFAROUTE[newRouteId].push(lastTripId);
                }
                GoogleTransitData.TRIPS[lastTripId].routeId = newRouteId;
                stopIdString = '';
                stops = [];
                GoogleTransitData.STOPTIMESOFATRIP[stopTime.tripId] = i;
            }
            stopIdString += stopTime.stopId.toString() + ','
            stops.push(stopTime.stopId);
            lastTripId = stopTime.tripId;
        }
    }

    private static initializeRoutesServingStops() {
        const routesServingStops: RouteStopMapping[][] = new Array(GoogleTransitData.STOPS.length);
        for(let i = 0; i < GoogleTransitData.STOPS.length; i++){
            routesServingStops[i] = [];
        }
        for(let i = 0; i < GoogleTransitData.STOPTIMES.length; i++) {
            let stopId = GoogleTransitData.STOPTIMES[i].stopId;
            let tripId = GoogleTransitData.STOPTIMES[i].tripId;
            let stopSequence = GoogleTransitData.STOPTIMES[i].stopSequence;
            let routeId = GoogleTransitData.TRIPS[tripId].routeId;
            let containsRouteId = false;
            for(let j = 0; j < routesServingStops[stopId].length; j++){
                if(routesServingStops[stopId][j].routeId === routeId){
                    containsRouteId = true;
                }
            }
            if(!containsRouteId){
                let routeStopMapping: RouteStopMapping = {
                    routeId: routeId,
                    stopSequence: stopSequence
                }
                routesServingStops[stopId].push(routeStopMapping);
            }
        }
        GoogleTransitData.ROUTESSERVINGSTOPS = routesServingStops;
    }

    private static initializeAllStopsOfARoute() {
        const stopsOfARoute: number[][] = new Array(GoogleTransitData.ROUTES.length);
        for(let i = 0; i < GoogleTransitData.ROUTES.length; i++){
            let trip: number = GoogleTransitData.getFirstTripOfARoute(i);
            let stopTimes = GoogleTransitData.getAllStopTimesOfATripSortedBySequence(trip);
            let stops: number[] = [];
            for(let j = 0; j < stopTimes.length; j++){
                stops.push(stopTimes[j].stopId)
            }
            stopsOfARoute[i] = stops;
        }
        GoogleTransitData.STOPSOFAROUTE = stopsOfARoute;
    }

    private static analyzeRoutes() {
        let versions = new Array(10);
        for(let i = 0; i < versions.length; i++){
            versions[i] = 0;
        }
        for(let i = 0; i < GoogleTransitData.ROUTES.length; i++){
            let stopsOfRoute: number[][] = [];
            let trips = GoogleTransitData.getTripsOfARoute(GoogleTransitData.ROUTES[i].id);
            for(let j = 0; j < trips.length; j++){
                let stopTimes = GoogleTransitData.getAllStopTimesOfATripSortedBySequence(trips[j]);
                let stopsOfTrip = [];
                let alreadyIncluded = false;
                for(let k = 0; k < stopTimes.length; k++){
                    stopsOfTrip.push(stopTimes[k].stopId);
                }
                for(let k = 0; k < stopsOfRoute.length; k++){
                    let equal = true;
                    if(stopsOfRoute[k].length !== stopsOfTrip.length){
                        equal = false;
                    } else {
                        for(let l = 0; l < stopsOfTrip.length; l++){
                            if(stopsOfRoute[k][l] !== stopTimes[l].stopId){
                                equal = false;
                                break;
                            }
                        }
                    }
                    if(equal){
                        alreadyIncluded = true;
                        break;
                    }
                }
                if(stopsOfRoute.length === 0 || !alreadyIncluded){
                    stopsOfRoute.push(stopsOfTrip)
                }
            }
            versions[stopsOfRoute.length] += 1; 
        }
        console.log(versions);
    }
}