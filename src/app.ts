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
Generator.generateFootpaths();
let departureStop = [12172];
let arrivalStop = [1234];
let departureTime = Converter.timeToSeconds('12:00:00');

let result = ConnectionScanController.connectionScanAlgorithm('Stuttgart-Rohr', 'Düsseldorf-Zoo', departureTime);

for(let i = 0; i < result.legs.length; i++){
  console.log(result.legs[i]);
  console.log(result.transfers[i]);
}

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