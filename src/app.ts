import express from 'express';
import routes from './server/routes';
import cors from 'cors';
import { Importer } from './data/importer';
import { Generator } from './data/generator';
import { RaptorAlgorithmController } from './server/controller/raptorAlgorithmController';
import { TestController } from './server/controller/testController';
import { GoogleTransitData } from './data/google-transit-data';
import { Converter } from './data/converter';
import { Calculator } from './data/calculator';

const app = express();

// imports the gtfs files
Importer.importGoogleTransitData();
// generates routes which can be used by the raptor algorithm
Generator.generateValidRoutes();
// genreates connections which can be used by the csa
Generator.generateSortedConnections();
// generates footpaths which can be used by raptor and csa
Generator.generateFootpaths();
TestController.testAlgorithms();

// let firstStopTimeOfTrip = GoogleTransitData.STOPTIMESOFATRIP[19900];
// for(let j = firstStopTimeOfTrip; j < GoogleTransitData.STOPTIMES.length; j++) {
//   let stopTime = GoogleTransitData.STOPTIMES[j];
//   if(19900 !== stopTime.tripId){
//     break;
//   }
//   console.log(stopTime)
//   console.log(GoogleTransitData.STOPS[stopTime.stopId])
// }

// firstStopTimeOfTrip = GoogleTransitData.STOPTIMESOFATRIP[19894];
// for(let j = firstStopTimeOfTrip; j < GoogleTransitData.STOPTIMES.length; j++) {
//   let stopTime = GoogleTransitData.STOPTIMES[j];
//   if(19894 !== stopTime.tripId){
//     break;
//   }
//   console.log(stopTime)
//   console.log(GoogleTransitData.STOPS[stopTime.stopId])
// }

// let routeId = GoogleTransitData.TRIPS[10282].routeId
// console.log(10282)
// console.log(routeId)
// for(let i = 0; i < GoogleTransitData.STOPSOFAROUTE[routeId].length; i++){
//   let stopId = GoogleTransitData.STOPSOFAROUTE[routeId][i];
//   console.log(GoogleTransitData.STOPS[stopId].name)
// }

// routeId = GoogleTransitData.TRIPS[8825].routeId
// console.log(8825)
// console.log(routeId)
// for(let i = 0; i < GoogleTransitData.STOPSOFAROUTE[routeId].length; i++){
//   let stopId = GoogleTransitData.STOPSOFAROUTE[routeId][i];
//   console.log(GoogleTransitData.STOPS[stopId].name)
// }

// routeId = GoogleTransitData.TRIPS[23130].routeId
// console.log(23130)
// console.log(routeId)
// // for(let i = 0; i < GoogleTransitData.STOPSOFAROUTE[routeId].length; i++){
// //   let stopId = GoogleTransitData.STOPSOFAROUTE[routeId][i];
// //   console.log(GoogleTransitData.STOPS[stopId].name)
// // }

// console.log(GoogleTransitData.STOPSOFAROUTE[routeId]);

// routeId = GoogleTransitData.TRIPS[23131].routeId
// console.log(23131)
// console.log(routeId)
// for(let i = 0; i < GoogleTransitData.STOPSOFAROUTE[routeId].length; i++){
//   let stopId = GoogleTransitData.STOPSOFAROUTE[routeId][i];
//   console.log(GoogleTransitData.STOPS[stopId].name)
// }

// routeId = GoogleTransitData.TRIPS[18967].routeId
// console.log(18967)
// console.log(routeId)
// for(let i = 0; i < GoogleTransitData.STOPSOFAROUTE[routeId].length; i++){
//   let stopId = GoogleTransitData.STOPSOFAROUTE[routeId][i];
//   console.log(GoogleTransitData.STOPS[stopId].name)
// }

// routeId = GoogleTransitData.TRIPS[30707].routeId
// console.log(30707)
// console.log(routeId)
// for(let i = 0; i < GoogleTransitData.STOPSOFAROUTE[routeId].length; i++){
//   let stopId = GoogleTransitData.STOPSOFAROUTE[routeId][i];
//   console.log(GoogleTransitData.STOPS[stopId].name)
// }

// routeId = GoogleTransitData.TRIPS[21426].routeId
// console.log(21426)
// console.log(routeId)
// for(let i = 0; i < GoogleTransitData.STOPSOFAROUTE[routeId].length; i++){
//   let stopId = GoogleTransitData.STOPSOFAROUTE[routeId][i];
//   console.log(GoogleTransitData.STOPS[stopId].name)
// }

// for(let i = -18; i < 18; i++){
//   console.log(Calculator.moduloSeven(i))
// }


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