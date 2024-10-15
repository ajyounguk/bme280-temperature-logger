const axios = require("axios");

// Fetch MetOffice data and save it to MongoDB, publish to MQTT
const fetchMetOfficeData = async (config, saveToMongo, publishToMQTT) => {
  const { enabled, APIKey, locationID } = config.MetOffice;
  if (!enabled) return;

  const url = `http://datapoint.metoffice.gov.uk/public/data/val/wxobs/all/json/${locationID}?res=hourly&key=${APIKey}`;
  try {
    const response = await axios.get(url);
    const lastPeriod = response.data.SiteRep.DV.Location.Period.slice(-1)[0].Rep.slice(-1)[0];
    const outdoorData = {
      temperature: lastPeriod.T,
      humidity: lastPeriod.H,
      pressure: lastPeriod.P,
      wind: lastPeriod.S,
    };

    console.log(
      `<INFO> MetOffice reading: ${outdoorData.temperature}C, ${outdoorData.pressure} hPa, ${outdoorData.humidity}%`
    );

    // Save MetOffice data to MongoDB using the specified collection
    await saveToMongo({
      source: "outside",
      temperature: outdoorData.temperature,
      pressure: outdoorData.pressure,
      humidity: outdoorData.humidity,
      wind: outdoorData.wind,
    }, config.MongoDB.collection); // Pass the collection from the config
};

module.exports = { fetchMetOfficeData };
