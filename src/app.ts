import express from 'express';
import routes from './server/routes';
import cors from 'cors';
import { Importer } from './data/importer';
import { GoogleTransitData } from './data/google-transit-data';
import { Generator } from './data/generator';

const app = express();

Importer.importGoogleTransitData();
Generator.generateSortedConnections();
Generator.generateTransfers();

for(let i = 0; i < 20; i++){
  console.log(GoogleTransitData.TRANSFERS[i])
}
console.log(GoogleTransitData.TRANSFERS[GoogleTransitData.TRANSFERS.length - 1])
console.log(GoogleTransitData.TRANSFERS.length)

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