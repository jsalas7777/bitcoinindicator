const axios = require("axios");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const apiKey = "LpEORp23xQCPDIxa1t";
const apiSecret = "hbL12eJgn8cGYrsOPhhzdVVloj8UJ1tKV55B";
const test_net = false;

const {
  InverseClient,
  LinearClient,
  InverseFuturesClient,
  SpotClientV3,
  UnifiedMarginClient,
  USDCOptionClient,
  USDCPerpetualClient,
  AccountAssetClient,
  CopyTradingClient,
  RestClientV5,
} = require("bybit-api");

// Setup readline to capture user input from the terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Define constants for start date, end date
const startDate = new Date("2024-01-01").getTime(); // Start date (milliseconds)
const endDate = new Date("2025-01-01").getTime(); // End date (milliseconds)

const getKlineData = async (
  symbol,
  startTimestamp,
  endTimestamp,
  interval = "60"
) => {
  try {
    const response = await axios.get("https://api.bybit.com/v5/market/kline", {
      params: {
        category: "inverse", // adjust if you are using a different category
        symbol: symbol,
        interval: interval, // interval in minutes (e.g., 60 for 1-hour)
        start: startTimestamp,
        end: endTimestamp,
      },
    });

    // Check if there is more data available and handle pagination
    if (response.data.result.list.length > 0) {
      return response.data.result.list;
    }
    return [];
  } catch (error) {
    console.error("Error fetching kline data:", error);
    return [];
  }
};

const downloadData = async (symbol) => {
  console.log("DOWNLOADING ", symbol);

  let startTimestamp = startDate;
  let allData = [];

  // Loop to fetch data in 120-hour chunks
  while (startTimestamp < endDate) {
    const endTimestamp = Math.min(
      startTimestamp + 120 * 60 * 60 * 1000,
      endDate
    ); // 120 hours in ms
    const klineData = await getKlineData(symbol, startTimestamp, endTimestamp);

    if (klineData.length > 0) {
      // Add new data and avoid duplicates based on timestamp
      klineData.forEach((item) => {
        if (!allData.some((existingItem) => existingItem[0] === item[0])) {
          allData.push(item);
        }
      });
    }

    // Update startTimestamp for the next iteration
    startTimestamp = endTimestamp;
  }

  // Sort data by timestamp (ascending)
  allData.sort((a, b) => a[0] - b[0]);

  return allData;
};

const saveDataToCSV = (data, symbol) => {
  // Ensure the "bybit_data" folder exists
  const folderPath = path.join(__dirname, "bybit_data");
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  const csvWriter = createCsvWriter({
    path: path.join(folderPath, `${symbol}_kline_data.csv`),
    header: [
      { id: "timestamp", title: "Timestamp" },
      { id: "open", title: "Open Price" },
      { id: "high", title: "High Price" },
      { id: "low", title: "Low Price" },
      { id: "close", title: "Close Price" },
      { id: "volume", title: "Volume" },
      { id: "turnover", title: "Turnover" },
    ],
  });

  const records = data.map((item) => ({
    timestamp: item[0], // Keep timestamp as milliseconds
    open: item[1],
    high: item[2],
    low: item[3],
    close: item[4],
    volume: item[5],
    turnover: item[6],
  }));

  csvWriter
    .writeRecords(records)
    .then(() => {
      console.log(`Data saved to bybit_data/${symbol}_kline_data.csv`);
    })
    .catch((err) => {
      console.error("Error writing CSV file:", err);
    });
};


const downloadBitcoin = async () => {
    

    let data = await downloadData("BTCUSDT");

    await saveDataToCSV(data, "BTCUSDT");
  

  };
  


// Prompt the user for the symbol to download
rl.question(
  'Enter the symbol to download data for (e.g., BTCUSD), or type "Bitcoin" to call the Download Bitcoin function: ',
  (input) => {
    if (input.toLowerCase() === "bitcoin") {
      downloadBitcoin();
      rl.close();
    } else {
      downloadData(input)
        .then((data) => {
          saveDataToCSV(data, input);
          rl.close();
        })
        .catch((error) => {
          console.error("Error downloading data:", error);
          rl.close();
        });
    }
  }
);
