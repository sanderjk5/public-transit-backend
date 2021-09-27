import express from 'express';
import routes from './server/routes';
import cors from 'cors';
import { Importer } from './data/importer';
import { Generator } from './data/generator';
import { TestController } from './server/controller/testController';
import { GoogleTransitData } from './data/google-transit-data';

const app = express();

// imports the gtfs files
Importer.importGoogleTransitData();
// generates routes which can be used by the raptor algorithm
Generator.generateValidRoutes();
// genreates connections which can be used by the csa
Generator.generateSortedConnections();
// generates footpaths which can be used by raptor and csa
Generator.generateFootpaths();
//TestController.testAlgorithms();

let trip = 41238;
console.log('trip: ' + trip)
let route = GoogleTransitData.TRIPS[trip].routeId;
console.log('route: ' + route)
for(let stop of GoogleTransitData.STOPSOFAROUTE[route]){
  console.log(GoogleTransitData.STOPS[stop].name)
}
console.log(GoogleTransitData.CALENDAR[GoogleTransitData.TRIPS[trip].serviceId].isAvailable)

trip = 41745;
console.log('trip: ' + trip)
route = GoogleTransitData.TRIPS[trip].routeId;
console.log('route: ' + route)
for(let stop of GoogleTransitData.STOPSOFAROUTE[route]){
  console.log(GoogleTransitData.STOPS[stop].name)
}
console.log(GoogleTransitData.CALENDAR[GoogleTransitData.TRIPS[trip].serviceId].isAvailable)



const port = 1337;
const corsOptions = {
  origin: 'http://localhost:4200',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204 
}
app.use(cors(corsOptions));

// uses the defined routes
app.use(routes);

// initializes the http port of the backend
app.listen(port, () => {
  return console.log(`server is listening on ${port}`);
});