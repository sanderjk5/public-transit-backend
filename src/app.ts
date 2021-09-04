import express from 'express';
import routes from './server/routes';
import cors from 'cors';
import { Importer } from './data/importer';
import { GoogleTransitData } from './data/google-transit-data';
import { Generator } from './data/generator';
import { ConnectionScanController } from './server/controller/ConnectionScanController';
import { Converter } from './data/converter';

const app = express();

Importer.importGoogleTransitData();
Generator.generateSortedConnections();
Generator.generateTransfers();
let departureStop = 13749;
let arrivalStop = 24;
let departureTime = Converter.timeToSeconds('12:00:00');
console.log(GoogleTransitData.STOPS[departureStop])
console.log(GoogleTransitData.STOPS[arrivalStop])
ConnectionScanController.connectionScanAlgorithm(departureStop, arrivalStop, departureTime);

const port = 1337;
const corsOptions = {
  origin: 'http://localhost:4200',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204 
}
app.use(cors(corsOptions));
app.use(routes);

app.listen(port, () => {
  return console.log(`server is listening on ${port}`);
});