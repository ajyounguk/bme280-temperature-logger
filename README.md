# BME280 Temperature Logger (NodeJS) 

## What is this?

> **Note (as of 10/24) This repository is likely no longer maintained, as I've shifted development to the Python version of this application, available [here.](https://github.com/ajyounguk/bme280-temperature-logger)**

This is a Node.js app designed to run on Raspberry Pi's that periodically records temperature, barometric pressure, and humidity readings from a BME280 sensor and stores the data into a MongoDB database. The app also collects meteorological data from the MetOffice to compare with sensor readings, if required.

The application can be configured to post the sensor and MetOffice data to a MongoDB collection and/or an MQTT topic. This data can be integrated with Home Assistant.

**Example Use Case:**

You can run two Raspberry Pis, capturing temperature data from two different rooms (e.g., Sammy's room and Lounge) while also collecting MetOffice data for your area (outside). You can create charts using the free tier of MongoDB Charts (see more in the notes below).

![mongoChart](/screenshots/mongoChart.png?raw=true)

#### Repository Contents

- `app.js`: Main app. 
- `/src`: Contains modules for MQTT, Mongo, MetOffice, sensor, and logging logic.
- `/config`: Example configuration file.
- `/screenshots`: Screenshots and illustrations.
- `/test`: A couple of simple test apps for sensor functionality in isolation (python and nodejs)


#### Note on Pi Zero (Unsupported)
The LTS version of node is not officially supported on the Pi Zero (32 bit ARMv6) architecture. I could not get the sensor libraries working even with a unnoficial LTS version of Node installed. (see a guide from [Sebastian Mandrean here](https://gist.github.com/mandrean/71f2cbf707025a5983c0fc04d78f3e9a) if you want to try. 

This code has been tested on a ARMv8 64-bit Raspberry Pi 3 Model B Rev 1.2.

#### Installation

First, install Git and Node.js on your Raspberry Pi.

Clone the repo and install the required modules:

```bash
git clone https://github.com/ajyounguk/bme280-temperature-logger
cd bme280-temperature-logger
npm install
```


# Configuration File

Copy the sample configuration file:

```bash
cd config
cp templog-config-sample.json templog-config.json
```

Edit the configuration `templog-config.json` file. Guidance is provided below:

#### General
- `General.readingIntervalSeconds`: Interval between sensor and MetOffice readings.

#### Sensor

- `Sensor.deviceID`: Your ID for identifying this device (e.g., `lounge_sensor`, `home`).
- `Sensor.i2cBusNumber`: BME280 Bus number (typically 1).
- `Sensor.i2cAddress`: The default I2C address (varies between 0x76 and 0x77).
- `Sensor.MQTTtopic`: The MQTT topic name to post sensor data (if required), e.g., `/homeassistant/my_bme280`.

> Depending on your hardware, the BME280 bus number and address may differ. See additional notes for sensor below.


#### MetOffice

- `MetOffice.enabled`: Enable or disable MetOffice data collection (`true` or `false`). If `false`, no further MetOffice configuration is needed.
- `MetOffice.deviceId`: Your ID for identifying the MetOffice data (e.g., `MetOffice`, `home_metoffice`).
- `MetOffice.apiKey`: Your MetOffice API key (can be obtained [here](https://www.metoffice.gov.uk/services/data/datapoint/api)).
- `MetOffice.locationID`: Numeric value for your MetOffice geographical location (see notes below).
- `MetOffice.MQTTtopic`: MQTT topic for posting MetOffice data (if required), e.g., `/homeassistant/metoffice_london`.

> The `locationID` denotes your weather data location. You may find success using 4-digit location IDs, often representing larger regions or counties. See [this list](https://gist.github.com/ajyounguk/e05db10df74e0b86c7e6a0a39a95f1f4) for more.

#### MQTT

- `MQTT.enabled`: Enable or disable MQTT data posting (`true` or `false`). If `false`, no further MQTT configuration is needed.
- `MQTT.brokerUrl`: The URL for the MQTT broker (for Home Assistant, use the IP or FQDN, e.g., `mqtt://192.168.1.250`).
- `MQTT.username`: MQTT username (for Home Assistant, use a dedicated user created for MQTT).
- `MQTT.password`: The corresponding MQTT password.

#### MongoDB

- `MongoDB.enabled`: Enable or disable MongoDB data posting (`true` or `false`). If `false`, no further Mongo configuration is needed.
- `MongoDB.url`: Connection string for your MongoDB database (e.g., `mongodb+srv://my_user:my_passwd@cluster0.mongodb.net/my_db?retryWrites=true&w=majority` for MongoDB Atlas).
- `MongoDB.collection`: MongoDB collection name for storing readings.

### How to Run It

Run the application like any Node.js app:

```bash
node app.js
```

# Additional Notes

#### Automatic Start, Monitoring, and Restart

I recommend using [pm2](https://pm2.keymetrics.io/docs/usage/quick-start/) to manage the app, ensuring it stays alive during disconnections or reboots.

#### MongoDB

MongoDB can be hosted anywhere. The app works well with a free-tier Mongo Atlas cloud database. See [MongoDB Atlas](https://cloud.mongodb.com).

- The `deviceId` is used to populate the `source` field in MongoDB documents, allowing multiple devices to store readings in the same collection.
- The MongoDB document structure looks like this:

![mongoDoc](/screenshots/mongoDoc.png?raw=true)

You can visualize data from different devices using MongoDB Charts. See [MongoDB Charts](https://www.mongodb.com/products/charts).

#### MetOffice

- MetOffice readings are saved to MongoDB with a hardcoded source of `"outside"`.
- MetOffice readings are created once per hour, regardless of how many devices are running or how frequently readings are taken.
- The code checks for an existing MetOffice reading in the current hour and only creates a new entry if none exists.

#### BME280 Sensor

Ensure that I2C is enabled on the Pi via `raspi-config` (under `Interface Options` > `I2C`):

```bash
sudo raspi-config
```

- The sensor typically operates on an I2C bus. To ensure proper communication, verify the bus number and address configuration. You can use `i2cdetect` to verify if your sensor is detected correctly.

To detect the port number for the BME280 sensor, use this command (note: the bus port may vary depending on the Pi model):

```bash
# install i2cdetect
sudo apt-get update
sudo apt-get install i2c-tools
```

```bash
i2cdetect -y 1 # for newwer models
i2cdetect -y 0  # for older 256MB Pi
```
- In case of errors, double-check the wiring and bus settings. [There is a guide here](https://www.hackster.io/Shilleh/beginner-tutorial-how-to-connect-raspberry-pi-and-bme280-4fdbd5)


#### Home Assistant Integration

For those using Home Assistant, you can use the MQTT integration to display temperature, pressure, and humidity data from your sensors. 

Configure your Home Assistant `configuration.yaml` file to listen to the relevant MQTT topics in line with this example:



```yaml
mqtt:
  sensor:
    - name: "BME280 Temperature"
      state_topic: "homeassistant/bme280_dev"
      unit_of_measurement: "°C"
      value_template: "{{ value_json.temperature }}"
  
    - name: "BME280 Pressure"
      state_topic: "homeassistant/bme280_dev"
      unit_of_measurement: "hPa"
      value_template: "{{ value_json.pressure }}"
  
    - name: "BME280 Humidity"
      state_topic: "homeassistant/bme280_dev"
      unit_of_measurement: "%"
      value_template: "{{ value_json.humidity }}"
  
    - name: "BME280 Wind Speed"
      state_topic: "homeassistant/bme280_dev"
      unit_of_measurement: "m/s"
      value_template: "{{ value_json.wind }}"
  
    - name: "Met Office Temperature"
      state_topic: "homeassistant/metoffice_dev"
      unit_of_measurement: "°C"
      value_template: "{{ value_json.temperature }}"
  
    - name: "Met Office Pressure"
      state_topic: "homeassistant/metoffice_dev"
      unit_of_measurement: "hPa"
      value_template: "{{ value_json.pressure }}"
  
    - name: "Met Office Humidity"
      state_topic: "homeassistant/metoffice_dev"
      unit_of_measurement: "%"
      value_template: "{{ value_json.humidity }}"
  
    - name: "Met Office Wind Speed"
      state_topic: "homeassistant/metoffice_dev"
      unit_of_measurement: "m/s"
      value_template: "{{ value_json.wind }}"
```
Home Assistant Screenshots

![HA](/screenshots/HA.png?raw=true)

![HA2](/screenshots/HA2.png?raw=true)













