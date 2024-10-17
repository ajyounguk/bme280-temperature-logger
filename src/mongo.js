const mongoose = require("mongoose");

// Connect to MongoDB
const mongoConnect = async (url) => {
  try {
    await mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("<INFO> Connected to MongoDB");
  } catch (error) {
    console.error("<ERROR> MongoDB connection error:", error);
    process.exit(1);
  }
};

// Function to dynamically create a schema/model for the specified collection
const temperatureModel = (collection) => {
  // if the model already exists return it
  if (mongoose.models[collection]) {
    return mongoose.models[collection];
  }

  const temperatureReadingSchema = new mongoose.Schema({
    source: String,
    timestamp: { type: Date, default: Date.now },
    temperature: Number,
    pressure: Number,
    humidity: Number,
    wind: Number,
  });

  // Create model for the collection
  return mongoose.model(collection, temperatureReadingSchema);
};

// If checkHour flag is set to true, this function will only save a record if none exists in the current hour period/slot
// This is used for MetOffice data saves to Mongo for 2 reasons:
//  1. The MetOffice API reading only changes once per hour so anything more would be redundant.
//  2. You might have multiple devices running all trying to write MetOffice data, which would also be redunant.
// Therefore this logic ensures there is only a single record in the DB per hour for MetOffice readings regardless 
// of the config interval or how many devices might be running.

const saveToMongo = async (data, collection, checkHour) => {
  const temperatureReadingModel = temperatureModel(collection);

  if (checkHour) {
    // Get the start and end of the current hour
    const now = new Date();
    const startOfHour = new Date(now.setMinutes(0, 0, 0)); // Start of the current hour
    const endOfHour = new Date(now.setMinutes(59, 59, 999)); // End of the current hour

    try {
      // Check if a record from the same source (device) was created within the current hour
      const existingRecord = await temperatureReadingModel.findOne({
        source: data.source,
        timestamp: { $gte: startOfHour, $lt: endOfHour }
      });

      // If a record exists, skip the save
      if (existingRecord) {
        return;
      }
    } catch (error) {
      console.error("<ERROR> Checking Mongo Hour Interval:", error);
    }

    // If no record exists, proceed with saving the new data
    const reading = new temperatureReadingModel(data);
    try {
      await reading.save();
    } catch (error) {
      console.error("<ERROR> MongoDB query/save error:", error);
    }
  }
};

module.exports = { mongoConnect, temperatureModel, saveToMongo };
