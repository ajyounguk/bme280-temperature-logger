// Main File (e.g., index.js or app.js)

// Required modules
const fs = require("fs");

// Custom modules (mqtt, mongo, metoffice and sensor concerns)
const mqtt = require("./src/mqtt");
const mongo = require("./src/mongo");
const metoffice = require("./src/metoffice");
const sensor = require("./src/sensor");
const logger = require("./src/logger");

// Load config from file
const myConfig = JSON.parse(
  fs.readFileSync(__dirname + "/config/templog-config.json", "utf8")
);

// Helper function for reading/loop delay
const delay = () => new Promise((resolve) => setTimeout(resolve, myConfig.General.readingIntervalSeconds * 1000));

// init running flag
let running = true;


// report status 
logger.createLog ("INFO", "Starting with status - MetOffice: " + myConfig.MetOffice.enabled + ", MQTT: " + myConfig.MQTT.enabled + ", MongoDB: " + myConfig.MongoDB.enabled)


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
   sensor.initSensor(myConfig.Sensor.i2cBusNumber, myConfig.Sensor.i2cAddress);
} catch (error) {

  logger.createLog ("ERROR", "Sensor initialisation failed with" + error)

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


      // METOFFICE =======================================================================================================================================

      // Get MetOffice reading and send to Mongo / MQTT
      if (myConfig.MetOffice.enabled) {

        metOfficeData = await metoffice.getMetOfficeData(myConfig.MetOffice.locationID, myConfig.MetOffice.apiKey );    

        logger.createLog ("INFO", "Device (" + myConfig.MetOffice.deviceId +")\treading: " + metOfficeData.temperature + "C, "+ metOfficeData.pressure + " hPa, " + metOfficeData.humidity +"%, " + metOfficeData.wind +" mph" )
        
      
        // Save metOffice data to MongoDB
        if (myConfig.MongoDB.enabled) {
          await mongo.saveToMongo({
            source: myConfig.MetOffice.deviceId,
            temperature: metOfficeData.temperature,
            pressure: metOfficeData.pressure,
            humidity: metOfficeData.humidity,
            wind :metOfficeData.wind
          }, myConfig.MongoDB.collection, true);
        }

         // Publish MetOffice data to MQTT
        if (myConfig.MQTT.enabled) {
           
            mqtt.publishToMQTT({
            source: myConfig.MetOffice.deviceId,
            temperature: metOfficeData.temperature,
            pressure: metOfficeData.pressure,
            humidity: metOfficeData.humidity,
            wind: metOfficeData.wind
            }, myConfig.MetOffice.MQTTtopic);
        }
      }
  
      // SENSOR =======================================================================================================================================

      // Get sensor reading and send to Mongo / MQTT
      const sensorData = await sensor.getSensorReading();

      logger.createLog ("INFO", "Device (" + myConfig.Sensor.deviceId +")\treading: " + sensorData.temperature + "C, "+ sensorData.pressure + " hPa, " + sensorData.humidity +"%")
      
      
      // Save sensor data to MongoDB
      if (myConfig.MongoDB.enabled) {
        await mongo.saveToMongo({
          source: myConfig.Sensor.deviceId,
          temperature: sensorData.temperature,
          pressure: sensorData.pressure,
          humidity: sensorData.humidity,
          wind : null
        }, myConfig.MongoDB.collection, false);

      }

      if (myConfig.MQTT.enabled) {
        // Publish sensor data to MQTT
        mqtt.publishToMQTT({
          source: myConfig.Sensor.deviceId,
          temperature: sensorData.temperature,
          pressure: sensorData.pressure,
          humidity: sensorData.humidity,
          wind: null
          }, myConfig.Sensor.MQTTtopic);
      }

    // main loop error handling
    } catch (error) {
      console.error("<ERROR>", error);
      process.exit(1);
    }

    
    // Wait for the next reading
    await delay();
  
  }

  // Close connections when done
  await sensor.closeSensor();
  logger.createLog ("INFO", "Sensor stopped")
};


// Start the process
reportContinuous(running).catch((error) => {
  logger.createLog ("FATAL", "Stopping with error " + error)
  process.exit(1);
});
