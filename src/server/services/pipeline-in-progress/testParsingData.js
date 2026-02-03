	/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const loadArrayInput = require('./loadArrayInput.js');
const Meter = require('../../models/Meter');
const { getConnection } = require('../../db');
const {log} = require('../../log');
// TODO: Mock server will be removed later 
// This is a Johnson Control API call file not data file 
// Refactor function of OneDayRequest to recieve request with meter object with meter start time and end time with meter conn, changing it to 1 day to just a request
// This allows for the test to run 
// Tagging the fucntions and file names tagged with JC
//Create a function to indicate where the log messages are coming from as well later on have the meter name

const {JCMeterStartTime} = require('../../../../ballstateFIles/ball.js'); 

//Run JS formatter 



/**
 * Processes meter readings from a JSON data file and uploads them to OED database.
 * Handles data validation, reliability checks, and reading transformations.
 * @param meter meter object to update readings with
 * @param conn database connection to use
 * @returns {Promise.<array.<Reading>>}
 */
async function OneDayRequest(meter, conn) {
	// Pushing the check if meter is bad to upper level, OED won't be sending a bad meter object
	 if (!meter || !meter.id) {
			log.error(`Invalid meter object — cannot find meter ID`);
			return { 	
				isAllReadingsOk: false, 
				msgTotal: 'Invalid meter object — cannot find meter ID' };
		}

	try {

		// Resolve project root path and construct file path for readings data
		// File is stored in server/tmp/ to prevent git commits of sensitive data
		//const projectRoot = path.resolve(__dirname, '../../../');
		//const txtFilePath = path.join(projectRoot,'server', 'tmp', 'oneday-request.txt');

		// Validate meter object before processing


		//TODO:
		//Fetching the data needs to be it's own function
		//The request of JC meter needs to go to the real server, allow or have it accessing both real server and mock server for testing purpose
		const rawData = await JCMeterStartTime('2025-10-24T23:00:00Z', '2025-10-29T01:00:00Z').catch(console.error);
		//Want everything to be dependent on a variable
		log.info(`Fetched raw data from API: ${JSON.stringify(rawData)}`);  // Better logging

		const json = rawData;  // Already an object, no parsing needed!
		

		
		// Read and parse the JSON data file containing meter readings
		//const data = await fs.readFile(txtFilePath, 'utf8');
		// const json = JSON.parse(rawData);  
		// const jsonItems = json?.items || [];

		
		// Check data reliability flag - log warning if data is marked as unreliable
		if (json.hasOwnProperty('isReliable') && json.isReliable === false) {
			log.warn(`Data reliability warning: isReliable flag is false for meter ${meter.name} (ID: ${meter.id})`);
		}
		
		// Check for required energy units - temporary solution until proper unit handling is implemented
		if (json.hasOwnProperty('unitEnumSet.kwattHours') && json.unitEnumSet.kwattHours === false) {
			log.warn(`Unit warning: kwattHours flag is false for meter ${meter.name} (ID: ${meter.id})`);
		}

		//TODO: if/else logic if there is no data else run the rest of the code, move this above the reliability check 
		// Ensure we have data to process
		if (jsonItems.length === 0) {
			log.error("No data returned from the query.");

		}


		//TODO: Check if the samples is there, if not log a warning stop the processing. Continue


		const jsonItems = json?.samples || []; 
		
		// Process readings: filter valid numeric values and apply transformations
		const meterReadings = jsonItems
    	.filter(rec => typeof rec.value === "number")  
    	.map(rec => {
        	let value = rec.value;  
        	if (process.env.NODE_ENV === 'production') {
            	value = value * 1.5 + 10;
        	}
       		return [value, rec.timestamp];  
    });

		log.info(`Parsed ${meterReadings.length} readings from file`);

		// Load processed readings into OED database using the standard array input handler
		return await loadArrayInput(
			meterReadings, 
			meter.id, 
			row => [row[0], row[1]], 
			'increasing', //timeSort
			1, //readingRepitition
			true, //isCumulative
			true, //cumulativeReset
			'00:00:00', //cumulativeResetStart
			'23:59:59', //cumulativeResetEnd
			0, // readingGap
			0, //readingLengthVariation
			true, //isEndOnly
			false, //shouldUpdate
			{
				//Latest values from readings
				minVal: meter.minVal,
				maxVal: meter.maxVal,
				minDate: meter.minDate,
				maxDate: meter.maxDate,
				threshold: 0,
				maxError: meter.maxError,
				disableChecks: meter.disableChecks
			},
			conn, 
			true, //relaxedParsing
			false,//useMeterZone
			true //warnOnCumulativeReset
		);
	} catch (err) {
		// Handle any errors during the reading processing pipeline
		log.error("Error in OneDayRequest:", err.message);
		return Promise.resolve({ isAllReadingsOk: false, msgTotal: err.message });
	}
}

/**
 * Test function to demonstrate OneDayRequest functionality with BSUData meter
 * This is primarily for development and testing purposes
 */
async function main() {
	try {
		// Establish database connection
		const conn = await getConnection();
		if (!conn) {
			throw new Error('Could not establish database connection');
		}
		
		console.log('Attempting to upload readings to BSUData meter...');
		
		// Retrieve the target meter from database
		const meter = await Meter.getByName('BSUData', conn); 
		if (!meter) {
			throw new Error('Could not find BSUData meter');
		}

		console.log(`Found meter: ${meter.name} (ID: ${meter.id})`);
		
		// Execute the reading import process
		const result = await OneDayRequest(meter, conn);
		
		// Report on the outcome
		if (result.isAllReadingsOk) {
			console.log('Successfully uploaded readings to BSUData meter');
		} else {
			log.warn('Error uploading readings:', result.msgTotal);
		}
	} catch (error) {
		log.error('Test failed:', error.stack || error.message);
	}
}

if (require.main === module) {
	main().catch(console.error);
}


module.exports = { main }
