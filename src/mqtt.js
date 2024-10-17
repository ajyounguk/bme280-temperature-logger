const mqtt = require("mqtt");
const logger = require("./logger");

let mqttClient;

// Connect to MQTT broker
const mqttConnect = (brokerUrl, mqttOptions) => {
  mqttClient = mqtt.connect(brokerUrl, mqttOptions);

  mqttClient.on("connect", () => {
    logger.createLog("INFO", "MQTT connected to broker: " + brokerUrl);
  });

  mqttClient.on("error", (error) => {
    logger.log("ERROR", "MQTT connection error:" + error);
    process.exit(1)
  });
};

// Publish data to MQTT
const publishToMQTT = ( data, topic) => {
  if (!mqttClient) return;

  mqttClient.publish(
    topic,
    JSON.stringify({  ...data, timestamp: new Date() })
  );
};

module.exports = { mqttConnect, publishToMQTT };
