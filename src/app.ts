import express from 'express';
import routes from './server/routes';
import cors from 'cors';
import { Importer } from './data/importer';
import { Generator } from './data/generator';
import { Reliability } from './data/reliability';
const app = express();

// imports the gtfs files
Importer.importGoogleTransitData();
// combines stops with the same name
Generator.combineStops();
// generates routes which can be used by the raptor algorithm
Generator.generateValidRoutes();
// sets the isAvailable array of each trip
Generator.setIsAvailableOfTrips();
// removes invalid trips and sorts the remaining by their departure time
Generator.clearAndSortTrips();
// genreates connections which can be used by the csa
Generator.generateSortedConnections();
// generates footpaths which can be used by raptor and csa
Generator.generateFootpaths();
// initializes the reliability values
Reliability.initReliability();

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