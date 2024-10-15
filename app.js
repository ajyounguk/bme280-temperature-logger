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
const delay = () => new Promise((resolve) => setTimeout(resolve, myConfig.General.readingInterval * 1000));


// init running flag
let running = true;

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
  console.log(
    "<ERROR> Sensor initialisation failed with " + error
  );
  running = false;
  return; // Exit if sensor cannot be initialized
}




// Main async loop
const reportContinuous = async (running) => {

  // Graceful shutdown
  process.on("SIGINT", () => {
    running = false;
  });

  while (running) {

    try {
      // Fetch MetOffice data and save it to MongoDB, publish to MQTT

      if (myConfig.MetOffice.enabled) {

        metOfficeData = await metoffice.getMetOfficeData(myConfig.MetOffice.locationID, myConfig.MetOffice.APIKey);      

      // Save metOffice data to MongoDB
      if (myConfig.MongoDB.enabled) {
        await mongo.saveToMongo({
          source: 'metOffice',
          temperature: metOfficeData.temperature,
          pressure: metOfficeData.pressure,
          humidity: metOfficeData.humidity,
          wind :metOfficeData.wind
        }, myConfig.MongoDB.collection);
      }

      if (myConfig.MQTT.enabled) {
          // Publish MetOffice data to MQTT
          mqtt.publishToMQTT('metOffice', {
          temperature: metOfficeData.temperature,
          pressure: metOfficeData.pressure,
          humidity: metOfficeData.humidity,
          wind: metOfficeData.wind
          });
        }
      }
  

    // Get sensor reading
      const sensorData = await sensor.getSensorReading();

      // Log sensor data
      console.log(
        `<INFO> Device (${myConfig.General.deviceId}) reading: ${sensorData.temperature}C, ${sensorData.pressure} hPa, ${sensorData.humidity}%`
      );

      // Save sensor data to MongoDB
      if (myConfig.MongoDB.enabled) {
        await mongo.saveToMongo({
          source: myConfig.General.deviceId,
          temperature: sensorData.temperature,
          pressure: sensorData.pressure,
          humidity: sensorData.humidity,
          wind : null
        }, myConfig.MongoDB.collection);

      }

      if (myConfig.MQTT.enabled) {
        // Publish sensor data to MQTT
        mqtt.publishToMQTT('bme380sensor', {
        temperature: sensorData.temperature,
        pressure: sensorData.pressure,
        humidity: sensorData.humidity,
        wind: null
        });
      }
    } catch (error) {
      console.error("<ERROR> Unkown location", error);
      process.exit(1);
    }

    
      // Wait for the next reading
    await delay();
  
  }

  // Close connections when done
  await sensor.closeSensor();
  console.log("<INFO> Device stopped");
};


// Start the process
reportContinuous(running).catch((error) => {
  console.error("<FATAL> Device stopping:", error);
  process.exit(1);
});
