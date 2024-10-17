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

// Save data to MongoDB
//const saveToMongo = async (data, collection) => {
//  const temperatureReadingModel = temperatureModel(collection);
//  const reading = new temperatureReadingModel(data);
//  try {
//    await reading.save();
//  } catch (error) {
//    console.error("<ERROR> MongoDB save error:", error);
//  }
// };


// This function will only save a record if none exists in the current hour slow
// we use this for metoffice saves as the API reading only changes once per hour
// therefore if we have multiple devices writing the metoffice data there is no point in saving 
// more than one record per hour

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
        console.log(`<INFO> Skipping save for device (${data.source}), record already exists for the current hour.`);
        return;
      }
   }

    // If no record exists, proceed with saving the new data
    const reading = new temperatureReadingModel(data);
    await reading.save();

  } catch (error) {
    console.error("<ERROR> MongoDB query/save error:", error);
  }
};




module.exports = { mongoConnect, temperatureModel, saveToMongo };
