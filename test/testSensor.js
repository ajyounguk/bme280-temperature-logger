// tempmon - device
//
// gathers reading results from bm280 sensor and post it to mongo database

// Modules
const bme280 = require("bme280");

var fs = require("fs");

// load config from file
var myConfig = JSON.parse(
  fs.readFileSync(__dirname + "/../config/templog-config.json", "utf8")
);

var BMEi2cBusNumber = myConfig.BMEi2cBusNumber;
var BMEi2cAddress = myConfig.BMEi2cAddress;
var readingInterval = 2

// helper functions
const format = (number) => (Math.round(number * 100) / 100).toFixed(2);
const delay = (millis) =>
  new Promise((resolve) => setTimeout(resolve, readingInterval * 1000));

// main
const reportContinuous = async (_) => {
  var running = true;

  // open sensor
  const sensor = await bme280.open({
    i2cBusNumber: BMEi2cBusNumber,
    i2cAddress: Number(BMEi2cAddress),
    humidityOversampling: bme280.OVERSAMPLE.X1,
    pressureOversampling: bme280.OVERSAMPLE.X16,
    temperatureOversampling: bme280.OVERSAMPLE.X2,
    filterCoefficient: bme280.FILTER.F16,
  });

  // main loop
  while (running) {
    const reading = await sensor.read();

    // debug output

    console.log(
      "sensor readings at " +
        new Date() +
        ": " +
        `${format(reading.temperature)}°C, ` +
        `${format(reading.pressure)} hPa, ` +
        `${format(reading.humidity)}%`
    );

    // wait reading interval and loop
    await delay(readingInterval);
  }

  // close connections
  await sensor.close();
  console.log("temperature monitor sensor test stopped");
};

// run
console.log("temperature monitor sensor test starting");
reportContinuous().catch(console.log);
