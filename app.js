// modules
var mongoose = require("mongoose");
var fs = require("fs");
const axios = require("axios");
const bme280 = require("bme280");
const mqtt = require("mqtt");

// load config from file
var myConfig = JSON.parse(
  fs.readFileSync(__dirname + "/config/templog-config.json", "utf8")
);

// Extract values from config file
var deviceId = myConfig.Application.deviceId;
var readingInterval = myConfig.Application.readingInterval || 10;
var BMEi2cBusNumber = myConfig.Hardware.i2cBusNumber;
var BMEi2cAddress = myConfig.Hardware.i2cAddress;

var mqttEnabled = myConfig.MQTT.enabled;
var mqttBrokerUrl = mqttEnabled ? myConfig.MQTT.brokerUrl : null;
var mqttTopic = mqttEnabled ? myConfig.MQTT.topic : null;

var mongoEnabled = myConfig.MongoDB.enabled;
var mongourl = mongoEnabled ? myConfig.MongoDB.url : null;
var mongoCollection = mongoEnabled ? myConfig.MongoDB.collection : null;

var metOReading = myConfig.MetOffice.enabled;
var APIKey = metOReading ? myConfig.MetOffice.APIKey : null;
var locationID = metOReading ? myConfig.MetOffice.locationID : null;

console.log(mongoEnabled + " " + mongourl + " " + mongoCollection)

// Ensure MongoDB is enabled
if ((mongoEnabled && !mongourl) || (mongoEnabled && !mongoCollection)) {
  console.log(
    "<FATAL> MongoDB is not properly configured. Please check your config file."
  );
  process.exit(1);
}

// Ensure MetOffice is enabled (if using)
var metparams = metOReading ? "?res=hourly&key=" + APIKey : null;
var MetOfficeURL = metOReading
  ? "http://datapoint.metoffice.gov.uk/public/data/val/wxobs/all/json/" +
  locationID
  : null;

// Helper functions
const format = (number) => (Math.round(number * 100) / 100).toFixed(2);
const delay = () =>
  new Promise((resolve) => setTimeout(resolve, readingInterval * 1000));

if (mongoEnabled) {
  // MongoDB schema
  var Schema = mongoose.Schema;
  var temperatureReadingSchema = new Schema({
    source: String,
    timestamp: Date,
    temperature: Number,
    pressure: Number,
    humidity: Number,
    wind: Number,
  });

  // MongoDB model
  var temperatureReadingModel = mongoose.model(
    mongoCollection,
    temperatureReadingSchema
  );

}




// Connect to MQTT broker if enabled
var mqttClient = null;
if (mqttEnabled) {
  mqttClient = mqtt.connect(mqttBrokerUrl);

  mqttClient.on("connect", () => {
    console.log("<INFO> MQTT connected to broker: " + mqttBrokerUrl);
  });

  mqttClient.on("error", (error) => {
    console.error("<ERROR> MQTT connection error:", error);
  });
}

// Main loop async function
var running = true;

const reportContinuous = async (_) => {
  var sensor = null;
  var reading = null;

  // Connect to MongoDB
  if (mongoEnabled) {
    try {
      await mongoose.connect(mongourl, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    } catch (error) {
      console.log("<ERROR> MongoDB connection error");
      console.error(error);
      running = false;
    }

    mongoose.connection.on("error", (error) => {
      console.log("<ERROR> MongoDB error");
      console.error(error);
      running = false;
    });

    mongoose.connection.on("reject", (error) => {
      console.log("<ERROR> MongoDB connection rejection error");
      console.error(error);
      running = false;
    });
  }

  // Open sensor
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
      console.log("<ERROR> BME280 sensor connection error");
      console.error(error);
      running = false;
    });

  // Main loop
  while (running) {
    // Handle MetOffice readings (if enabled)
    if (metOReading) {
      var day = new Date().getDate();
      var month = new Date().getMonth();
      var year = new Date().getFullYear();
      var hour = new Date().getHours();

      // Check if there is already a reading for the current hour
      temperatureReadingModel.countDocuments(
        {
          timestamp: { $gte: new Date(year, month, day, hour, 0, 0, 0) },
          source: "outside",
        },
        async function (err, count) {
          if (count === 0) {
            // Get current temperature from MetOffice API
            await axios
              .get(MetOfficeURL + metparams)
              .then((response) => {
                var myj = response.data;

                var lastPeriod =
                  myj.SiteRep.DV.Location.Period.slice(-1)[0].Rep.slice(-1)[0];

                var outdoorTemperature = lastPeriod.T;
                var outdoorHumidity = lastPeriod.H;
                var outdoorPressure = lastPeriod.P;
                var outdoorWind = lastPeriod.S;

                // Log MetOffice reading
                console.log(
                  `<INFO> MetOffice reading: ${outdoorTemperature}C, ${outdoorPressure} hPa, ${outdoorHumidity}%`
                );

                if (mongoEnabled) {
                  // Save MetOffice reading to MongoDB
                  var temperatureReadingDocument = new temperatureReadingModel({
                    source: "outside",
                    timestamp: new Date(),
                    temperature: outdoorTemperature,
                    pressure: outdoorPressure,
                    humidity: outdoorHumidity,
                    wind: outdoorWind,
                  });

                  temperatureReadingDocument.save(function (error) {
                    if (error) {
                      console.error(
                        "<ERROR> Error saving MetOffice reading:",
                        error
                      );
                      running = false;
                    }
                  });
                }

                // Publish MetOffice temperature to MQTT
                if (mqttEnabled && mqttClient) {
                  mqttClient.publish(
                    mqttTopic,
                    JSON.stringify({
                      source: "MetOffice",
                      temperature: outdoorTemperature,
                      humidity: outdoorHumidity,
                      pressure: outdoorPressure,
                      wind: outdoorWind,
                      timestamp: new Date(),
                    })
                  );
                  console.log(
                    `<INFO> Published MetOffice temperature to MQTT: ${outdoorTemperature}C`
                  );
                }
              })
              .catch((error) => {
                console.error("<ERROR> MetOffice API error:", error);
                running = false;
              });
          }
        }
      );
    }

    // Get sensor reading
    reading = await sensor.read();

    // Log sensor reading
    console.log(
      `<INFO> Device (${deviceId}) reading: ${format(
        reading.temperature
      )}C, ${format(reading.pressure)} hPa, ${format(reading.humidity)}%`
    );

    // Save sensor reading to MongoDB
    if (mongoEnabled) {
      var temperatureReadingDocument = new temperatureReadingModel({
        source: deviceId,
        timestamp: new Date(),
        temperature: format(reading.temperature),
        pressure: format(reading.pressure),
        humidity: format(reading.humidity),
        wind: null,
      });

      temperatureReadingDocument.save(function (error) {
        if (error) {
          console.error("<ERROR> Error saving sensor reading:", error);
          running = false;
        }
      });
    }

    // Publish sensor temperature to MQTT
    if (mqttEnabled && mqttClient) {
      mqttClient.publish(
        mqttTopic,
        JSON.stringify({
          source: deviceId,
          temperature: format(reading.temperature),
          humidity: format(reading.humidity),
          pressure: format(reading.pressure),
          wind: null,
          timestamp: new Date(),
        })
      );
      console.log(
        `<INFO> Published sensor temperature to MQTT: ${format(
          reading.temperature
        )}C`
      );
    }

    // Wait for the next reading interval
    if (running) await delay();
  }

  // Close sensor and MongoDB connection when done
  await sensor.close();
  await mongoose.connection.close();
  console.log("<INFO> Device stopped");
};

// Run the main process
console.log("<INFO> Device starting");
if (running) {
  reportContinuous().catch((error) => {
    running = false;
    console.error("<FATAL> Device stopping:", error);
    process.exit(1);
  })
}



