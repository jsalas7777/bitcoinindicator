# bitcoinindicator
This is a learning repository how to use Tensorflowjs to predict if Bitcoin is bullish or bearish

## Installation
Install all required npm packages

## How it works

### Step 1
Call the (DownloadBybitBitcoinData.js) via node
This will download all the historical data of Bitcoin

### Step 2
Call (VerifyBybitDataHour.js) Via node
This will make sure the data is sorted in an Ascending Manner and no hour is missing

### Step 3
Call Process_Bybit_Data.js Via node
this fill gets the historical data and converts in a coherent list of closing prices that will later be used to train our model

### Step 4
Call the process Normalize_Filter Via node
Thsi will Normalize the process data because MachineLearning needs the data to be normalized in order to be used

### Step 5
Call CreateAIModel.js this will search for the normalized data and create a AI Model that based on the data provided will give a an answer POSITIVE,NEGATIVE,OR NEUTRAL indicating what is the most likely movement of the stock

