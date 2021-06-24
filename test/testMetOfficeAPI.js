// tempmon - device
//
// gathers reading results from bm280 sensor and post it to mongo database

// Modules
const axios = require("axios");
const fs = require('fs')

// load config from file
var myConfig = JSON.parse(
  fs.readFileSync(__dirname + "/../config/templog-config.json", "utf8")
);

var readingInterval = 2;
var APIKey = myConfig.metOAPIKey;
var metOLocationID = myConfig.metOLocationID;


// helper functions
const format = (number) => (Math.round(number * 100) / 100).toFixed(2);
const delay = (millis) =>
  new Promise((resolve) => setTimeout(resolve, readingInterval * 1000));



// main
const reportContinuous = async (_) => {
  var running = true;

  // main loop
  while (running) {

    // change location hardcoded here (e.g. 3414) to test other locations IDs
    // 3414 = Shropshire
    var url =
      "http://datapoint.metoffice.gov.uk/public/data/val/wxobs/all/json/" + metOLocationID;
    var args =
      "?res=hourly&key=" + APIKey + "&time=" +
      new Date().toISOString();

    await console.log("Calling API at: " + url + args);

    axios
      .get(url + args)
      .then((response) => {
        var myj = JSON.parse(JSON.stringify(response.data));
        var temperature = myj.SiteRep.DV.Location.Period.Rep.T;
        console.log("current temperature is: " + temperature + "C");
      })
      .catch((error) => {
        console.log(error);
      });

    // wait reading interval and loop
    await delay(readingInterval);
  }

  // close connections
  console.log("MetOffice test stopped");
};

// run
console.log("MetOffice API test starting");
reportContinuous().catch(console.log);
