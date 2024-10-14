// Required modules
const fs = require("fs");
const bme280 = require("bme280");
const { saveToMongo } = require("./mongo");
const { publishToMQTT } = require("./mqtt");
const { fetchMetOfficeData } = require("./metoffice");

// Load config from file
const myConfig = JSON.parse(
  fs.readFileSync(__dirname + "/config/templog-config.json", "utf8")
);

// Extract values from config
const { deviceId, readingInterval = 10 } = myConfig.Application;
const { i2cBusNumber, i2cAddress } = myConfig.Hardware;

// Helper function
const format = (number) => (Math.round(number * 100) / 100).toFixed(2);
const delay = () => new Promise((resolve) => setTimeout(resolve, readingInterval * 1000));

let running = true;


const { mongoConnect } = require("./mongo");
const { mqttConnect } = require("./mqtt");

// Connect to MongoDB if enabled
if (myConfig.MongoDB.enabled) {
  mongoConnect(myConfig.MongoDB.url);
}

// Connect to MQTT broker if enabled
if (myConfig.MQTT.enabled) {
  mqttConnect(myConfig.MQTT.brokerUrl, {
    username: myConfig.MQTT.username,
    password: myConfig.MQTT.password,
  });
}

// Main async loop
const reportContinuous = async () => {
  // Open sensor
  let sensor;
  try {
    sensor = await bme280.open({
      i2cBusNumber,
      i2cAddress: Number(i2cAddress),
    });
  } catch (error) {
    console.error("<ERROR> BME280 sensor connection error", error);
    running = false;
  }

  while (running) {
    // Fetch MetOffice data and save it to MongoDB, publish to MQTT
    await fetchMetOfficeData(myConfig, saveToMongo, publishToMQTT);

    // Get sensor reading
    const reading = await sensor.read();
    const { temperature, pressure, humidity } = reading;

    // Log sensor data
    console.log(
      `<INFO> Device (${deviceId}) reading: ${format(temperature)}C, ${format(pressure)} hPa, ${format(humidity)}%`
    );

    // Save sensor data to MongoDB
    await saveToMongo({
      source: deviceId,
      temperature: format(temperature),
      pressure: format(pressure),
      humidity: format(humidity),
    });

    // Publish sensor data to MQTT
    publishToMQTT(deviceId, {
      temperature: format(temperature),
      pressure: format(pressure),
      humidity: format(humidity),
    });

    // Wait for the next reading
    await delay();
  }

  // Close connections when done
  if (sensor) await sensor.close();
  console.log("<INFO> Device stopped");
};

// Start the process
reportContinuous().catch((error) => {
  console.error("<FATAL> Device stopping:", error);
  process.exit(1);
});
