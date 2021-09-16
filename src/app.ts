import express from 'express';
import routes from './server/routes';
import cors from 'cors';
import { Importer } from './data/importer';
import { Generator } from './data/generator';
import { RaptorAlgorithmController } from './server/controller/raptorAlgorithmController';

const app = express();

Importer.importGoogleTransitData();
Generator.generateSortedConnections();
Generator.generateFootpaths();
//RaptorAlgorithmController.raptorAlgorithm(646, 12983, '08:12:00');
//ConnectionScanAlgorithmController.performAlgorithm([646], [12983], Converter.timeToSeconds('08:12:00'));
RaptorAlgorithmController.raptorAlgorithm('Stuttgart-Rohr', 'Stuttgart Hbf', '23:59:00');


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