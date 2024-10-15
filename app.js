// Main File (e.g., index.js or app.js)

// Required modules
const fs = require("fs");
const mqtt = require("./mqtt");
const mongo = require("./mongo");
const metoffice = require("./metoffice");
const sensor = require("./sensor");

// Load config from file
const myConfig = JSON.parse(
  fs.readFileSync(__dirname + "/config/templog-config.json", "utf8")
);

// Helper function for reading/loop delay
const delay = () => new Promise((resolve) => setTimeout(resolve, readingInterval * 1000));

const temperatureReading = {
  sensor: {
    temperature : 0,  
    humidity : 0,
    pressure : 0
  },
  metOffice: {
    temperature : 0,
    humidity : 0,
    pressure : 0,
    wind : 0
  }
};

// init running flag
let running = false;


// Connect to MongoDB if enabled (via mongo.js)
if (myConfig.MongoDB.enabled) {
  mongo.mongoConnect(myConfig.MongoDB.url);
}

// Connect to MQTT broker if enabled (via mqtt.js)
if (myConfig.MQTT.enabled) {
  mqtt.mqttConnect(myConfig.MQTT.brokerUrl, {
    username: myConfig.MQTT.username,
    password: myConfig.MQTT.password,
  });
}

// Initialise BME280 sensor (via sensor.js)
try {
   sensor.initSensor(myConfig.Hardware.i2cBusNumber, myConfig.Hardware.i2cAddress);
} catch (error) {
  running = false;
  console.log(
    "<ERROR> Sensor initialisation failed with " + error
  );
  return; // Exit if sensor cannot be initialized
}




// Main async loop
const reportContinuous = async () => {

  // Graceful shutdown
  process.on("SIGINT", () => {
    running = false;
  });

  while (running) {
    try {
      // Fetch MetOffice data and save it to MongoDB, publish to MQTT
      await metoffice.fetchMetOfficeData(myConfig);

      // Get sensor reading
      const sensorData = await sensor.getSensorReading();
      const { temperature, pressure, humidity } = sensorData;

      // Log sensor data
      console.log(
        `<INFO> Device (${deviceId}) reading: ${temperature}C, ${pressure} hPa, ${humidity}%`
      );

      // Save sensor data to MongoDB
      await mongo.saveToMongo({
        source: deviceId,
        temperature,
        pressure,
        humidity,
      }, myConfig.MongoDB.collection);

      // Publish sensor data to MQTT
      mqtt.publishToMQTT(deviceId, {
        temperature,
        pressure,
        humidity,
      });

      // Wait for the next reading
      await delay();
    } catch (error) {
      console.error("<ERROR> Error during reading or publishing:", error);
    }
  }

  // Close connections when done
  await sensor.closeSensor();
  console.log("<INFO> Device stopped");
};

// Start the process
reportContinuous().catch((error) => {
  console.error("<FATAL> Device stopping:", error);
  process.exit(1);
});
