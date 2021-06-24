// templog - A temperature monitor that uses the Bosch BM280 sensors to measure temperature, humidity and
//  barometric pressure with the raspberry pi
//
// there are 4 key parts to this application
//
// 1. Logic to read in parameters from a configuration file in /config
// 2. Logic to read the temperature, humidity and barometric pressure from the BME280 sensor
// 3. Logic to read the outdoor temperature, humidity and barometric pressure and wind speed from the MetOffice API (once an hour)
// 4. Logic to save the readings data to the MongoDB database


// modules
var mongoose = require("mongoose");
var fs = require("fs");
const axios = require("axios");
const bme280 = require("bme280");

// load config from file
var myConfig = JSON.parse(
  fs.readFileSync(__dirname + "/config/templog-config.json", "utf8")
);

var mongourl = myConfig.mongourl;
var mongoCollection = myConfig.mongoCollection;
var deviceId = myConfig.deviceId;
var readingInterval = myConfig.readingInterval;
var APIKey = myConfig.metOAPIKey;
var locationID = myConfig.metOLocationID;
var metOReading = myConfig.metOReading;
var BMEi2cBusNumber = myConfig.BMEi2cBusNumber;
var BMEi2cAddress = myConfig.BMEi2cAddress;


// 10 seconds default readings interval if not declared
if (readingInterval == undefined || readingInterval < 10) readingInterval = 10;

// metoffice URL parameters
var metparams = "?res=hourly&key=" + APIKey;

// metOffice weather request URL
var MetOfficeURL =
  "http://datapoint.metoffice.gov.uk/public/data/val/wxobs/all/json/" +
  locationID;

// helper functions
const format = (number) => (Math.round(number * 100) / 100).toFixed(2);
const delay = () =>
  new Promise((resolve) => setTimeout(resolve, readingInterval * 1000));

// mongo Schema
var Schema = mongoose.Schema;
var temperatureReadingSchema = new Schema({
  source: String,
  timestamp: Date,
  temperature: Number,
  pressure: Number,
  humidity: Number,
  wind: Number,
});

// mongo Model - note: temperature_readings = target collection
var temperatureReadingModel = mongoose.model(
  mongoCollection,
  temperatureReadingSchema
);

// main loop async function
var running = true;

const reportContinuous = async (_) => {
  var sensor = null;
  var reading = null;

  // connect to mongo
  try {
    await mongoose.connect(mongourl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (error) {
    console.log(
      "<ERROR> at " +
        new Date() +
        "MongoDB initial connection error - check config file"
    );
    console.log(JSON.stringify(error), null, 3);
    running = false;
  }

  mongoose.connection.on("error", (error) => {
    console.log("<ERROR> at " + new Date() + "MongoDB error");
    console.log(JSON.stringify(error), null, 3);
    running = false;
  });

  mongoose.connection.on("reject", (error) => {
    console.log(
      "<ERROR> at " + new Date() + "MongoDB connection rejection error"
    );
    console.log(JSON.stringify(error), null, 3);
    running = false;
  });

  // open sensor - note i2Address and i2cBusNumber may have to be changed
  sensor = await bme280
    .open({
      i2cBusNumber: BMEi2cBusNumber,
      i2cAddress: Number(BMEi2cAddress),
      humidityOversampling: bme280.OVERSAMPLE.X1,
      pressureOversampling: bme280.OVERSAMPLE.X16,
      temperatureOversampling: bme280.OVERSAMPLE.X2,
      filterCoefficient: bme280.FILTER.F16,
    })
    .then(sensor)
    .catch((error) => {
      console.log(
        "<ERROR> at " + new Date() + "BME280 sensor connection error"
      );
      console.log(JSON.stringify(error), null, 3);
      running = false;
    });

  // main loop
  while (running) {

    // if MetOffice reading is on
    if (metOReading) {      

      var day = new Date().getDate();
      var month = new Date().getMonth();
      var year = new Date().getFullYear();
      var hour = new Date().getHours();

      // only create a external temperature reading if no record exists in the current hour
      // since the metoffice readings only change hour by hour
      // this logic also ensures only one reading is created per hour should multiple devices
      // be deployed (e.g. only 1 record per hour written across all devices, first to save the
      // document in that hour period wins)

      temperatureReadingModel.countDocuments(
        {
          timestamp: { $gte: new Date(year, month, day, hour, 0, 0, 0) },
          source: "outside",
        },
        async function (err, count) {
          if (count === 0) {
            // get current temperature from metoffice
            await axios
              .get(MetOfficeURL + metparams)
              .then((response) => {
                var myj = JSON.parse(JSON.stringify(response.data));

                // get last metoffice observation in 24 hour dataset
                var numPeriods = myj.SiteRep.DV.Location.Period.length;
                var numReps =
                  myj.SiteRep.DV.Location.Period[numPeriods - 1].Rep.length;

                var outdoorTemperature =
                  myj.SiteRep.DV.Location.Period[numPeriods - 1].Rep[
                    numReps - 1
                  ].T;

                var outdoorHumidity =
                  myj.SiteRep.DV.Location.Period[numPeriods - 1].Rep[
                    numReps - 1
                  ].H;

                var outdoorPressure =
                  myj.SiteRep.DV.Location.Period[numPeriods - 1].Rep[
                    numReps - 1
                  ].P;

                var outdoorWind =
                  myj.SiteRep.DV.Location.Period[numPeriods - 1].Rep[
                    numReps - 1
                  ].S;

                // info output
                console.log(
                  "<INFO> metOffice reading at " +
                    new Date() +
                    ":" +
                    " outside temperature is: " +
                    outdoorTemperature +
                    "C"
                );

                // create mongo document for outdoor / metOffice readings and save
                var temperatureReadingDocument = temperatureReadingModel({
                  source: "outside",
                  timestamp: new Date(),
                  temperature: outdoorTemperature,
                  pressure: outdoorPressure,
                  humidity: outdoorHumidity,
                  wind: outdoorWind,
                });

                temperatureReadingDocument.save(function (error) {
                  if (error) {
                    console.log(
                      "<ERROR> at " +
                        new Date() +
                        "Error saving outdoor mongo document : ",
                      error
                    );
                    running = false;
                  }
                });
              })
              .catch((error) => {
                console.log(
                  "<ERROR> at " + new Date() + "Metoffice API error: " + error
                );
                running = false;
              });
          }
        }
      );
    }

    // get sensor reading
    reading = await sensor.read();

    // info output
    console.log(
      "<INFO> device (" +
        deviceId +
        ") reading at " +
        new Date() +
        ": " +
        `${format(reading.temperature)}°C, ` +
        `${format(reading.pressure)} hPa, ` +
        `${format(reading.humidity)}%`
    );

    var temperatureReadingDocument = temperatureReadingModel({
      source: deviceId,
      timestamp: new Date(),
      temperature: format(reading.temperature),
      pressure: format(reading.pressure),
      humidity: format(reading.humidity),
      wind: null,
    });

    temperatureReadingDocument.save(function (error) {
      if (error) {
        console.log(
          "<ERROR> at " + new Date() + "Error saving reading mongo document: ",
          error
        );
        running = false;
      }
    });

    // wait reading interval and loop
    if (running) await delay(readingInterval);
  } // end of while loop

  // close connections
  await sensor.close();

  await mongoose.connection.close();
  console.log("<ERROR> at " + new Date() + "device stopped");
};

// run
console.log("<INFO> device starting");
if (running)
  reportContinuous().catch((error) => {
    running = false;
    console.log("<FATAL> at " + new Date() + "stopping ", error);
    process.exit();
  });
