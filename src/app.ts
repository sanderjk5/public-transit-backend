import express from 'express';
import routes from './server/routes';
import cors from 'cors';
import { Importer } from './data/importer';
import { Generator } from './data/generator';
import { TestController } from './server/controller/testController';
import { Reliability } from './data/reliability';
import { GoogleTransitData } from './data/google-transit-data';
import { ProfileConnectionScanAlgorithmController } from './server/controller/profileConnectionScanAlgorithmController';
import { Converter } from './data/converter';

const app = express();

// imports the gtfs files
Importer.importGoogleTransitData();
// generates routes which can be used by the raptor algorithm
Generator.generateValidRoutes();
// genreates connections which can be used by the csa
Generator.generateSortedConnections();
// generates footpaths which can be used by raptor and csa
Generator.generateFootpaths();
Reliability.initReliability();
//TestController.testAlgorithms();

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