const mqtt = require("mqtt");

let mqttClient;

// Connect to MQTT broker
const mqttConnect = (brokerUrl, mqttOptions) => {
  mqttClient = mqtt.connect(brokerUrl, mqttOptions);

  mqttClient.on("connect", () => {
    console.log("<INFO> MQTT connected to broker: " + brokerUrl);
  });

  mqttClient.on("error", (error) => {
    console.  error("<ERROR> MQTT connection error:", error);
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
