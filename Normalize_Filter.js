const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { parse } = require("json2csv");

const filePath = path.join(
  "/Users/jose/tradinginsightsource/MachineLearningMultiBitcoin5minuteV1/filter",
  "total.csv"
);
const outputFilePath = path.join(
  "/Users/jose/tradinginsightsource/MachineLearningMultiBitcoin5minuteV1/filter",
  "normalized_total.csv"
);

const POSITIVE_LABEL = 1.1;
const NEGATIVE_LABEL = 0.9;

function containsNaN(row) {
  return Object.values(row).some((value) => value === "NaN" || value === "" || isNaN(Number(value)));
}

function normalizeRow(row) {
  const label = Number(row.label) || 0;
  const values = Object.values(row)
    .slice(0, -1)
    .map((v) => (isNaN(Number(v)) ? 0 : Number(v)));


  const lastValueInDataRow = values[values.length - 1];
  const baseValue = values[0];
  const normalizedValues = values.map((value) =>
     (value / baseValue).toFixed(2)
  );

  let normalizedLabel = (label / lastValueInDataRow).toFixed(2);

  if (normalizedLabel >= POSITIVE_LABEL) {
    normalizedLabel = "POSITIVE";
  } else if (normalizedLabel <= NEGATIVE_LABEL) {
    normalizedLabel = "NEGATIVE";
  } else {
    normalizedLabel = "NEUTRAL";
  }

  return normalizedValues.concat(normalizedLabel);
}

function processCSV() {
  const results = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => {
      if (!containsNaN(data)) {
        results.push(data);
      }
    })
    .on("end", () => {
      const normalizedData = results.map((row) => {
        const normalizedRow = normalizeRow(row);
        return Object.keys(row).reduce((obj, key, index) => {
          obj[key] = normalizedRow[index] || "0.00";
          return obj;
        }, {});
      });

      const csvOutput = parse(normalizedData);
      fs.writeFileSync(outputFilePath, csvOutput);
      console.log(`Normalization complete. Output saved to ${outputFilePath}`);
    });
}

processCSV();
