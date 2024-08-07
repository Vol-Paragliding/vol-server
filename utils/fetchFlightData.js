const axios = require("axios");

const fetchFlightDetailsFromPF = async (flightID) => {
  const url = `https://www.paraglidingforum.com/leonardo/EXT_flight.php?op=flight_info&flightID=${flightID}`;

  try {
    const response = await axios.get(url);
    if (response.status === 200) {
      const flightData = response.data;
      console.log("Flight data:", flightData);
      return flightData;
    } else {
      throw new Error("Failed to fetch flight details");
    }
  } catch (error) {
    console.error("Error fetching flight details:", error);
  }
};

fetchFlightDetailsFromPF("3421181");
