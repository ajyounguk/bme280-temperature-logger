// Import the required modules
const i2c = require('i2c-bus');
const Bme280 = require('bme280-sensor');

// Define I2C bus and sensor options
const I2C_BUS = 1; // Typically 1 for Raspberry Pi models
const options = {
  i2cBusNo: I2C_BUS,
  i2cAddress: Bme280.BME280_DEFAULT_I2C_ADDRESS(), // Default address for the BM280 sensor
};

// Initialize the sensor instance
const sensor = new Bme280(options);

// Read sensor data and print it
const readSensorData = async () => {
  try {
    await sensor.init(); // Initialize the sensor
    const data = await sensor.readSensorData(); // Read sensor data

    // Output sensor readings
    console.log(`Temperature: ${(data.temperature_C).toFixed(2)} °C`);
    console.log(`Humidity: ${(data.humidity).toFixed(2)} %`);
    console.log(`Pressure: ${(data.pressure_hPa).toFixed(2)} hPa`);

  } catch (error) {
    console.error('Error reading sensor data:', error);
  }
};

// Read sensor data every 5 seconds
setInterval(readSensorData, 5000);