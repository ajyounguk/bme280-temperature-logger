const mqtt = require("mqtt");

let mqttClient;

// Connect to MQTT broker
const mqttConnect = (brokerUrl, mqttOptions) => {
  mqttClient = mqtt.connect(brokerUrl, mqttOptions);

  mqttClient.on("connect", () => {
    console.log("<INFO> MQTT connected to broker: " + brokerUrl);
  });

  mqttClient.on("error", (error) => {
    console.error("<ERROR> MQTT connection error:", error);
  });
};

// Publish data to MQTT
const publishToMQTT = (source, data) => {
  if (!mqttClient) return;

  mqttClient.publish(
    "temperature/reading",
    JSON.stringify({ source, ...data, timestamp: new Date() })
  );

  console.log(`<INFO> Published ${source} data to MQTT`);
};

module.exports = { publishToMQTT, mqttConnect };
