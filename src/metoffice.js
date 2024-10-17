const axios = require("axios");

// Fetch MetOffice data and save it to MongoDB, publish to MQTT
const getMetOfficeData = async (locationID, APIKey) => {
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

      return outdoorData; 

    }  catch (error) {
      console.error("<ERROR> Axios Metoffice error:", error);

    }


  }

  module.exports = { getMetOfficeData };
