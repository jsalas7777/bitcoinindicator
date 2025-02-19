const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const inputFolder = './verified_bybit_data'; // Input folder containing CSV files
const outputFile = './filter/total.csv'; // Output file path updated to save in 'filters' folder
const label_skip = 144;  // Number of rows to skip after every 120 items
const index_skip = 10   // Number of rows to move for the next index

/**
 * Function to read and parse CSV files
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Array>} - Resolves with an array of closing prices
 */
const readCSVFile = (filePath) => {
    return new Promise((resolve, reject) => {
        const closingPrices = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                closingPrices.push(parseFloat(row.close));  // Collect closing price
            })
            .on('end', () => {
                resolve(closingPrices);
            })
            .on('error', (error) => {
                console.error(`Error reading ${filePath}:`, error); // Log any reading errors
                reject(error);
            });
    });
};

/**
 * Function to get all CSV file paths from a directory
 * @param {string} dir - Directory path
 * @returns {Array<string>} - List of CSV file paths
 */
const getCSVFiles = (dir) => {
    return fs.readdirSync(dir)
        .filter(file => path.extname(file) === '.csv')
        .map(file => path.join(dir, file));
};

/**
 * Function to append rows to a file incrementally to avoid memory issues
 * @param {string} filePath - File path to append data
 * @param {Array} rows - Array of rows to write to the file
 */
const appendToCSV = (filePath, rows) => {
    const data = rows.map(row => row.join(',')).join('\n');
    fs.appendFileSync(filePath, data + '\n', 'utf8');
};

/**
 * Main function to combine CSV data
 */
const combineCSVData = async () => {
    const csvFiles = getCSVFiles(inputFolder);
    console.log('CSV Files found:', csvFiles); // Debug log for found CSV files
    let allClosingPrices = [];

    // Process each CSV file and collect closing prices
    for (const file of csvFiles) {
        const closingPrices = await readCSVFile(file);
        allClosingPrices = allClosingPrices.concat(closingPrices);
    }

    console.log('Total closing prices collected:', allClosingPrices.length); // Debug log for total collected prices

    let currentIndex = 0;

    // Write the header to the final CSV file
    const header = Array.from({ length: 120 }, (_, i) => `data${i + 1}`).join(',') + ',label\n';
    fs.writeFileSync(outputFile, header, 'utf8');  // Write the header once

    // Process the data in blocks of 120 values with the label after applying label_skip
    while (currentIndex + 120 + label_skip < allClosingPrices.length) {
        const dataRow = allClosingPrices.slice(currentIndex, currentIndex + 120);  // Take 120 values
        const label = allClosingPrices[currentIndex + 120 + label_skip];  // Label is the value after the label_skip

        // Ensure that the dataRow is valid (no undefined or null values)
        if (dataRow.length === 120 && label !== undefined && label !== null) {
            dataRow.push(label);
            appendToCSV(outputFile, [dataRow]);  // Append the row incrementally to the file
        } else {
            console.warn(`Invalid dataRow at index ${currentIndex}:`, dataRow); // Warn if dataRow is invalid
        }

        currentIndex += index_skip;  // Move to the next index for the start of the next row
    }

    console.log(`Combined CSV data written to ${outputFile}`);
};

combineCSVData().catch(err => console.error('Error:', err));
