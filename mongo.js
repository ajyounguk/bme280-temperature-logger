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
const saveToMongo = async (data, collection) => {
  const temperatureReadingModel = temperatureModel(collection);
  const reading = new temperatureReadingModel(data);
  try {
    await reading.save();
    console.log("<INFO> Saved reading to MongoDB in collection:", collection);
  } catch (error) {
    console.error("<ERROR> MongoDB save error:", error);
  }
};

module.exports = { mongoConnect, temperatureModel, saveToMongo };
