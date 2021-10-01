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

export class Importer {
    // directory of the gtfs files.
    public static readonly GOOGLE_TRANSIT_DIRECTORY: string = path.join(__dirname, '../../data/');
    // maps to set the new ids. New ids should be equal to the position of the entry in the array.
    private static stopIdMap = new Map<number, number>();
    private static tripIdMap = new Map<number, number>();
    private static routeIdMap = new Map<number, number>();
    private static serviceIdMap = new Map<number, number>();

    /**
     * Imports the files of all gtfs directories.
     */
    public static importGoogleTransitData(): void {
        console.time('complete import')
        this.resetArrays();
        this.importDirectory('latest_schienenregionalverkehr', false)
        this.importDirectory('latest_schienenfernverkehr', true)
        console.timeEnd('complete import')
    }

    /**
     * Imports all relevant files of the given directory.
     * @param directoryName 
     */
    private static importDirectory(directoryName: string, isLongDistance: boolean): void {
        Importer.importAgency(directoryName + '/agency.txt');
        Importer.importCalendar(directoryName + '/calendar.txt');
        Importer.importCalendarDates(directoryName + '/calendar_dates.txt');
        Importer.importRoutes(directoryName + '/routes.txt');
        Importer.importStops(directoryName + '/stops.txt');
        Importer.importTrips(directoryName + '/trips.txt', isLongDistance);
        Importer.importStopTimes(directoryName + '/stop_times.txt');
    }

    /**
     * Resets all data arrays.
     */
    private static resetArrays() {
        GoogleTransitData.AGENCIES = [];
        GoogleTransitData.CALENDAR = [];
        GoogleTransitData.CALENDAR_DATES = [];
        GoogleTransitData.ROUTES = [];
        GoogleTransitData.STOPS = [];
        GoogleTransitData.TRIPS = [];
        GoogleTransitData.STOPTIMES = [];
    }

    /**
     * Imports the agency table.
     */
    private static importAgency(filename: string): void {
        console.time('import agency table');
        const importedAgency = GoogleTransitData.AGENCIES;
        const agencyData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_DIRECTORY, filename), 'utf-8').toString().split('\n');
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
        console.timeEnd('import agency table');
    }

    /**
     * Imports the calendar table.
     */
    private static importCalendar(filename: string): void {
        console.time('import calendar table');
        const importedCalendar = GoogleTransitData.CALENDAR;
        this.serviceIdMap = new Map<number, number>();
        const calendarData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_DIRECTORY, filename), 'utf-8').toString().split('\n');
        for(let i = 1; i < calendarData.length - 1; i++){
            const currentCalendarAsArray: string[] = calendarData[i].split(',');
            const startDate = currentCalendarAsArray[7]
            const endDate = currentCalendarAsArray[8];
            const serviceId = Number(currentCalendarAsArray[9]);
            const isAvailable = new Array(7);
            for(let i = 0; i < 7; i++){
                if(currentCalendarAsArray[i] === '1'){
                    isAvailable[i] = true;
                } else {
                    isAvailable[i] = false;
                }
            }
            const calendar: Calendar = {
                serviceId: importedCalendar.length,
                isAvailable: isAvailable,
                startDate: startDate,
                endDate: endDate
            }
            // sets the new id
            this.serviceIdMap.set(serviceId, calendar.serviceId);
            importedCalendar.push(calendar);
        }
        GoogleTransitData.CALENDAR = importedCalendar;
        console.timeEnd('import calendar table');
    }

    /**
     * Imports the calendar dates table.
     */
    private static importCalendarDates(filename: string): void {
        console.time('import calendar dates table');
        const importedCalendarDates = GoogleTransitData.CALENDAR_DATES;
        const calendarDatesData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_DIRECTORY, filename), 'utf-8').toString().split('\n');
        for(let i = 1; i < calendarDatesData.length - 1; i++){
            const currentCalendarDatesAsArray: string[] = calendarDatesData[i].split(',');
            // mapping to the new id
            const serviceId = Number(currentCalendarDatesAsArray[0]);
            const exceptionType = currentCalendarDatesAsArray[1];
            const date = currentCalendarDatesAsArray[2];
            const calendarDate: CalendarDate = {
                serviceId: this.serviceIdMap.get(serviceId),
                date: date,
                exception_type: exceptionType
            }
            if(calendarDate.serviceId !== undefined){
                importedCalendarDates.push(calendarDate);
            }
            importedCalendarDates.push(calendarDate);
        }
        GoogleTransitData.CALENDAR_DATES = importedCalendarDates;
        console.timeEnd('import calendar dates table');
    }

    /**
     * Imports the routes table.
     */
    private static importRoutes(filename: string): void {
        console.time('import route table');
        const importedRoutes = GoogleTransitData.ROUTES;
        this.routeIdMap = new Map<number, number>();
        const routeData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_DIRECTORY, filename), 'utf-8').toString().split('\n');
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
            // sets the new id
            this.routeIdMap.set(id, route.id);
            importedRoutes.push(route);
        }
        GoogleTransitData.ROUTES = importedRoutes;
        console.timeEnd('import route table');
    }
    
    /**
     * Imports the stop table.
     */
    private static importStops(filename: string): void {
        console.time('import stops table');
        const importedStops = GoogleTransitData.STOPS;
        this.stopIdMap = new Map<number, number>();
        const stopData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_DIRECTORY, filename), 'utf-8').toString().split('\n');
        for(let i = 1; i < stopData.length - 1; i++){
            const currentStopAsArray: string[] = stopData[i].split(',');
            const id = Number(currentStopAsArray[1]);
            const name = currentStopAsArray[0];
            const lat = Number(currentStopAsArray[2]);
            const lon = Number(currentStopAsArray[3]);
            const stop: Stop = {
                id: importedStops.length,
                name: name,
                lat: lat,
                lon: lon
            }
            // sets the new id
            this.stopIdMap.set(id, stop.id);
            importedStops.push(stop);
        }
        GoogleTransitData.STOPS = importedStops;
        console.timeEnd('import stops table');
    }

    /**
     * Imports the stop times table.
     */
    private static importStopTimes(filename: string): void {
        console.time('import stop times table');
        const importedStopTimes = GoogleTransitData.STOPTIMES;
        const stopTimeData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_DIRECTORY, filename), 'utf-8').toString().split('\n');
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
                // mapping to the new id
                tripId: this.tripIdMap.get(tripId),
                // converts the times
                arrivalTime: Converter.timeToSeconds(arrivalTime),
                departureTime: Converter.timeToSeconds(departureTime),
                // mapping to the new id
                stopId: this.stopIdMap.get(stopId),
                stopSequence: stopSequence,
                pickupType: pickupType,
                dropOffType: dropOffType,
            }
            // adds the stop time only when related trips and stops exists.
            if(stopTime.tripId !== undefined && stopTime.stopId !== undefined){
                importedStopTimes.push(stopTime);
            }
        }
        GoogleTransitData.STOPTIMES = importedStopTimes;
        console.timeEnd('import stop times table');
    }

    private static importTrips(filename: string, isLongDistance: boolean): void {
        console.time('import trips table');
        const importedTrips = GoogleTransitData.TRIPS;
        this.tripIdMap = new Map<number, number>();
        const tripData: string[] = readFileSync(path.join(this.GOOGLE_TRANSIT_DIRECTORY, filename), 'utf-8').toString().split('\n');
        for(let i = 1; i < tripData.length - 1; i++){
            const currentTripAsArray: string[] = tripData[i].split(',');
            const routeId = Number(currentTripAsArray[0]);
            const serviceId = Number(currentTripAsArray[1]);
            const id = Number(currentTripAsArray[3]);
            const directionId = Number(currentTripAsArray[2]);
            const trip: Trip = {
                // mapping to the new id
                routeId: this.routeIdMap.get(routeId),
                // mapping to the new id
                serviceId: this.serviceIdMap.get(serviceId),
                id: importedTrips.length,
                directionId: directionId,
                isLongDistance: isLongDistance,
            }
            // adds the trip only when a related route exists
            if(trip.routeId !== undefined && trip.serviceId !== undefined){
                // mapping to the new id
                this.tripIdMap.set(id, trip.id);
                importedTrips.push(trip);
            }
        }
        GoogleTransitData.TRIPS = importedTrips;
        console.timeEnd('import trips table');
    }
}