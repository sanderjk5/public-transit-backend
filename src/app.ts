import express from 'express';
import routes from './server/routes';
import cors from 'cors';
import { Importer } from './data/importer';
import { GoogleTransitData } from './data/google-transit-data';
import { Generator } from './data/generator';
import { ConnectionScanAlgorithmController } from './server/controller/connectionScanAlgorithmController';
import { Converter } from './data/converter';
import { RaptorAlgorithmController } from './server/controller/raptorAlgorithmController';

const app = express();

Importer.importGoogleTransitData();
Generator.generateSortedConnections();
Generator.generateFootpaths();
console.log(GoogleTransitData.TRIPS[38726])
console.log(GoogleTransitData.TRIPS[38724])
RaptorAlgorithmController.raptorAlgorithm(12172, 12179, '12:00:00');


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