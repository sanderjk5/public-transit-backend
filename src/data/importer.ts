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

    public static readonly GOOGLE_TRANSIT_FOLDER: string = path.join(__dirname, '../../google_transit');


    public static importGoogleTransitData(): void {
        console.time('import')
        Importer.importCalendar();
        Importer.importCalendarDates();
        Importer.importRoutes();
        Importer.importStops();
        Importer.importStopTimes();
        Importer.importTrips();
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
            const id = Number(currentRouteAsArray[5]);
            const agencyId = Number(currentRouteAsArray[3]);
            const shortName = currentRouteAsArray[1];
            const longName = currentRouteAsArray[0];
            const routeType = Number(currentRouteAsArray[4]);
            const route: Route = {
                id: id,
                agencyId: agencyId,
                shortName: shortName,
                longName: longName,
                routeType: routeType,
            }
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
                id: id,
                name: name,
                lat: lat,
                lon: lon
            }
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
                tripId: tripId,
                arrivalTime: Converter.timeToSeconds(arrivalTime),
                departureTime: Converter.timeToSeconds(departureTime),
                stopId: stopId,
                stopSequence: stopSequence,
                pickupType: pickupType,
                dropOffType: dropOffType,
            }
            importedStopTimes.push(stopTime);
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
                routeId: routeId,
                serviceId: serviceId,
                id: id,
                directionId: directionId,
            }
            importedTrips.push(trip);
        }
        GoogleTransitData.TRIPS = importedTrips;
        console.timeEnd('trips');
    }
}