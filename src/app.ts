import express from 'express';
import routes from './server/routes';
import cors from 'cors';
import { Importer } from './data/importer';

const app = express();

Importer.importGoogleTransitData();

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