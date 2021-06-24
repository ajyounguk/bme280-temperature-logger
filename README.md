## BME280 temperature logger

## What is this?
This is a nodejs app design to run on Raspberry Pi's with, that will make periodic temperature, barometric pressure and humidity readings from a BME280 sensor, and store the data into a MongoDB database. 

The app will also collect and store local meteorological data from the MetOffice so that it can be analysed and compared to local temperature readings. This option can be disabled in the config.

## Contents:
- app.js = main app. 
- /config = example configuration file 
- /screenshots = screenshots and illustrations
- /test = test applications, allow you to test the MetOffice and sensor functionality in isolation. Both apps require entries in the config set



## Installation overview
Install git and Node.js on raspberry pi


Clone the repo and install modules:

```
git clone https://github.com/ajyounguk/bme280-temperature-logger
cd bme280-temperature-logger
npm install
```

## Mongo Credentials
Copy the example configuration file 
```
cd config
cp templog-config-sample.json templog-config.json
```

Edit the config file:

1. Set the connection string for your Mongo database:
    ```
    "mongourl": "mongodb+srv://myuser:pass0@cluster0.mydb.mongodb.net/dbname?retryWrites=true&w=majority"
    ```



2. Set the Mongo database collection name for your reading documents:
    ```
    "mongoCollection": "my_collection_name"
    ```



3.  Set device ID with a meaningful name for your device readings:
    ```
    "deviceId": "kitchen"
    ```



4. Set the reading interval in seconds, this is the frequency readings are made from the sensor and stored in Mongo. E.g set to 600 for readings every. 10 seconds is the minimum/default in the app:
    ```
    "readingInterval": 60
    ```



5. Set the BME280 bus number and i2c address. Bus number is typically 1.  The default i2c address varies between 0x76 and 0x77. 
    ```
    "BMEi2cBusNumber": 1,
    "BMEi2cAddress": "0x76",
    ```
    


6. Enable / disable the MetOffice reading functionality:

    To skip the MetOffice readings, set: 
    ```
    "metOReading": false 
    ```   
    step 7 and 8 are not required if metOReading is set to false
   
    To enable MetOffice Readings set:
    ```
    "metOReading": true  
    ```
    and follow step 7-8


7. Set the MetOffice API KEY which authorises the app to use the MetOffice APIs:

    You can get an application/API key here https://www.metoffice.gov.uk/services/data/datapoint/api

    ```
    "metOAPIKey" : "NotRealKey-4054ggs6d-j3fiajd-fejrif8384s"
    ```



8. Set the MetOffice location ID:

    The metOLocationID denotes your location for the weather data, not all MetOffice locations provide weather readings data, but I've included a list from their location API here https://gist.github.com/ajyounguk/e05db10df74e0b86c7e6a0a39a95f1f4

    I had more luck with 4 digit location IDs which tend to be a County rather than a more generic location. For example, location ID 3414 for Shropshire works. The metOffice APIs and location configuration is a bit of a black art so your mileage might vary...

    ```
    "metOLocationID" : 3414
    ```

    


## How to run it
```
node app.js
```

## Notes

#### Mongo
Mongo can be hosted anywhere and works great with free Mongo Atlas cloud DB instances.

The collection name in the configcan be anything you like. Useful if you want to separate readings from different devices into different collections or target specific preset collections.

The deviceId is used to populate the source: field in the documents, allows you to have multiple devices saving readings into the same Mongo DB/collection.

MetOffice readings are saved into Mongo with a hardcoded source: of "outside"

MetOffice readings are only created once an hour, even if you have multiple devices. The code checks for an existing MetOffice reading document in Mongo and only adds a new one if none exist. This prevents multiple readings if you run more than one device. MetOffice readings tend to only be updated hourly anyhow.


#### BME280 
The sensor chip official datasheet can be found here https://www.bosch-sensortec.com/bst/products/all_products/bme280


#### Automatic monitoring and restart for the application
I used pm2 to run and monitor the app. This ensures the app stays alive following disconnects/reboots/power outages - see https://pm2.keymetrics.io/docs/usage/quick-start/


#### I2C Configuration
Note that depending on your hardware, the BME280 bus number and address may differ, you might have to change these in the config file.

Remember to enable I2C in on the Pi in the raspi-config (under Interface Options | I2C)
```
sudo raspi-config
```

On the Pi you can use this command to detect the port number for the connected BME280 sensor. Depending on pi model, the bus port number may vary (-y option) between 1 and 0
```
i2cdetect -y 1 

i2cdetect -y 0  # for older 256MB Pi
```
```
i2cBusNumber: 1,
i2cAddress: 0x76,
```

For more information on the BME280 implementation see https://www.npmjs.com/package/bme280. This code is based on the library examples and the link also has wiring diagrams for the sensor and Pi GPIO connections.

#### Graphs!
The free tier of Mongo Atlas supports graphs! I used these to visualise the readings from 3 different devices around the house. See https://www.mongodb.com/products/charts

Example:

Two Raspberri Pis, capturing temperature data from two different rooms in the house (Sammy's room and Lounge), in addition to logging the Metoffice data for our area (outside)
![mongoChart](/screenshots/mongoChart.png?raw=true)



