const mongoose = require("mongoose");

// MongoDB schema
const temperatureReadingSchema = new mongoose.Schema({
  source: String,
  timestamp: { type: Date, default: Date.now },
  temperature: Number,
  pressure: Number,
  humidity: Number,
  wind: Number,
});

// MongoDB model
const temperatureReadingModel = mongoose.model("TemperatureReading", temperatureReadingSchema);

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

// Save data to MongoDB
const saveToMongo = async (data) => {
  const reading = new temperatureReadingModel(data);
  try {
    await reading.save();
    console.log("<INFO> Saved reading to MongoDB");
  } catch (error) {
    console.error("<ERROR> MongoDB save error:", error);
  }
};

module.exports = { saveToMongo, mongoConnect };
