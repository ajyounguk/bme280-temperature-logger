const bme280 = require("bme280");
const logger = require("./logger");

// Helper function to format sensor readings
const format = (number) => (Math.round(number * 100) / 100).toFixed(2);

let sensor = null;

// Open BME280 sensor automatically when this module is required
const initSensor = async (i2cBusNumber, i2cAddress) => {
    try {
      sensor = await bme280.open({
        i2cBusNumber,
        i2cAddress: Number(i2cAddress),
      });
  
      logger.createLog("INFO", "Sensor initialized");
    } catch (error) {
      logger.createLog("ERROR", "Sensor connection error:"+ error);
      throw error;
    }
  };


// Get the sensor reading
const getSensorReading = async () => {
  if (!sensor) {
    throw new Error("Sensor not initialized");
  }
  try {
    const reading = await sensor.read();
    const { temperature, pressure, humidity } = reading;
    return {
      temperature: format(temperature),
      pressure: format(pressure),
      humidity: format(humidity),
    };
  } catch (error) {
    logger.log("ERROR", "Failed to read sensor data:"+ error);
    throw error;
  }
};

// Close the sensor connection
const closeSensor = async () => {
  if (sensor) {
    await sensor.close();
    logger.createLog("<INFO> BME280 sensor connection closed");
  }
};

module.exports = { initSensor, getSensorReading,  closeSensor};
