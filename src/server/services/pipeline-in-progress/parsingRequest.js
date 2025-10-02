const fs = require("fs").promises;
//We do not want a dataframe but translates it to a array in the format that OED can have 
//Need to call load array input when we have the data from JC Meters with proper switches 
//Parse the data
//setup the functions and calls to where it can be dropped into the pipeline, seeing how we drop data in 
//first grab the data from the API
async function OneDayRequest(){
    //this will turn into the API Call
    try{
    const data = await fs.readFile("C:/Users/fornt/OneDrive/Documents/SeniorYear/CS495/OED/src/bin/oneday-request.bin", 'utf8' )

    let parsedArray = []
    const json = JSON.parse(data)
    const jsonItems = json?.items
    //works as planned 
    
// Iterates over each record in jsonItems.
// Pulls out only the fields you care about (timestamp, value, units, isReliable).
// rec.value?.value and rec.value?.units again use optional chaining in case value is missing.
// Pushes a simplified object into parsedArray.
    if (Array.isArray(jsonItems)) {
            for (const rec of jsonItems) {
                parsedArray.push({
                    timestamp: rec.timestamp,
                    value: rec.value?.value,
                    units: rec.value?.units,
                    reliable: rec.isReliable
                });
            }
        }
        return parsedArray;
    } catch (err) {
        console.error("Error:", err.message);
        return [];
    }

}//END OF FUNCTION

// Run the test
(async () => {
  const result = await OneDayRequest();
  console.log("Confirmed result is array?", Array.isArray(result));
  //printing 3 of the arrays 
  console.log(result.slice(0,3))
})();

//grab [value] this contains 
//second see if this data is in an array
    //if not in array need to convert this data into a array
        //then parse through this data grabbing all the correct data 
