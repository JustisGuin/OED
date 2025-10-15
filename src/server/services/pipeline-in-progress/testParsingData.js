const fs = require('fs').promises;
const path = require('path');
const loadArrayInput = require('./loadArrayInput');
const Meter = require('../../models/Meter');
const { getConnection } = require('../../db');

/**
 * Returns a promise containing all the readings from the binary file
 * and uploads them to OED.
 * @param meter meter object to update readings with
 * @param conn database connection to use
 * @returns {Promise.<array.<Reading>>}
 */
async function OneDayRequest(meter, conn) {
    if (!meter || !meter.id) {
        throw new Error(`Invalid meter object — cannot find meter ID`);
    }

    try {
        const projectRoot = path.resolve(__dirname, '../../../');
        const binFilePath = path.join(projectRoot, 'bin', 'oneday-request.bin');
        const data = await fs.readFile(binFilePath, 'utf8');

        const json = JSON.parse(data);  
        const jsonItems = json?.items || [];

        if (jsonItems.length === 0) {
            throw new Error("No data returned from the query.");
        }
        const meterReadings = jsonItems
            .filter(rec => typeof rec.value?.value === "number")
            .map(rec => {
                const newVal = rec.value.value + 5; 
                return [newVal, rec.timestamp];
            });

        console.log(`Parsed ${meterReadings.length} readings from file`);

     
        return await loadArrayInput(
            meterReadings,
            meter.id,
            row => [row[0], row[1]],
            'increasing',
            1,
            true,
            true,
            '00:00:00',
            '23:59:59',
            0, // readingGap
            0,
            true,
            false,
            {
                minVal: meter.minVal,
                maxVal: meter.maxVal,
                minDate: meter.minDate,
                maxDate: meter.maxDate,
                threshold: 0,
                maxError: meter.maxError,
                disableChecks: meter.disableChecks
            },
            conn,
            true,
            false,
            true
        );
    } catch (err) {
        console.error("Error in OneDayRequest:", err.message);
        return { isAllReadingsOk: false, msgTotal: err.message };
    }
}





// Run test using BSUData meter
async function main() {
    try {
        const conn = await getConnection();
        if (!conn) throw new Error('Could not establish database connection');
        
        console.log('Attempting to upload readings to BSUData meter...');
        
        const meter = await Meter.getByName('BSUData', conn); 
        if (!meter) throw new Error('Could not find BSUData meter');

        console.log(`Found meter: ${meter.name} (ID: ${meter.id})`);
        
        const result = await OneDayRequest(meter, conn);
        if (result.isAllReadingsOk) {
            console.log('Successfully uploaded readings to BSUData meter');
        } else {
            console.log(' Error uploading readings:', result.msgTotal);
        }
    } catch (error) {
        console.error('Test failed:', error.stack || error.message);
    }
}


if (require.main === module) {
    main().catch(console.error);
}



module.exports = {main}