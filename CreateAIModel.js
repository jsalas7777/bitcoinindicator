const { Storage } = require("@google-cloud/storage");
const readline = require("readline");
const tf = require("@tensorflow/tfjs-node-gpu");
const csv = require("csv-parser");
const { fs } = require("file-system");

var express = require("express");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const storage = new Storage({ keyFilename: "service.json" });

let traindata = [];
let resultdata = [];

let testdata = null;
let testresponse = null;

let model = null;
var MODEL_NAME = "";

async function trainModel() {
  console.log("START LOADING");

  sleep(3000);
  console.log("FINISH LOADING");

  try {
    let savedModel = await tf.loadLayersModel(
      "file://./models/" + MODEL_NAME + "/model.json"
    );
    console.log("MODEL LOADED FROM DISK ", savedModel);

    model = savedModel;
  } catch (e) {
    model = tf.sequential();


    // GRU Layers
    model.add(
      tf.layers.gru({
        units: 32,
        inputShape: [120, 1], // 120 time steps, 1 feature per time step
        activation: "tanh",
        returnSequences: true,
        kernelInitializer: "glorotNormal",
      })
    );
    model.add(
      tf.layers.gru({
        units: 16,
        returnSequences: false,
        activation: "tanh",
        kernelInitializer: "glorotNormal",
      })
    );

    // Dropout Regularization
    model.add(tf.layers.dropout({ rate: 0.3 }));

    // Fully Connected Layers
    model.add(tf.layers.dense({ units: 16, activation: "relu" }));
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Output Layer
    model.add(
      tf.layers.dense({
        units: 3, // Number of classes
        activation: "softmax",
      })
    );

    // Compile the Model
    model.compile({
      optimizer: "adam",
      loss: huberLoss(1.0),
      metrics: ["accuracy"],
    });
  }


  
  function huberLoss(delta = 1.0) {
    return (yTrue, yPred) => {
      const error = tf.sub(yTrue, yPred).abs(); // Absolute error
      const quadratic = tf.minimum(error, delta); // Errors smaller than delta
      const linear = tf.sub(error, quadratic); // Errors larger than delta
      const loss = tf.add(
        quadratic.square().div(2), // Quadratic for small errors
        linear.mul(delta) // Linear for large errors
      );
      return loss.mean(); // Return mean loss
    };
  }

  model.compile({
    loss: huberLoss(1.0), // Use categorical crossentropy for multiclass classification
    optimizer: tf.train.adam(0.001), // Lower learning rate for stability
    metrics: ["accuracy"], // Accuracy for evaluation
  });

  const xs = tf.tensor2d(traindata, [traindata.length, 120]);
  const ys = tf.tensor2d(resultdata, [resultdata.length, 3]);
  const reshapedXs = xs.reshape([xs.shape[0], 120, 1]); // Reshape to 3D for GRU

  await testModel();

  async function train() {
    let epoch_counter = 0;
    let previous_loss = Number.MAX_VALUE;

    model.fit(reshapedXs, ys, {
      epochs: 1000000,
      validationSplit: 0.2, // Validate on 20% of data
      shuffle: true,
      callbacks: {
        onEpochEnd: async (_, l) => {
          const loss = l.loss;
          console.log("LOSS", loss, "/", previous_loss);

          if (epoch_counter % 1 === 0) {
            await testModel();

            if (loss < previous_loss) {
              previous_loss = loss;

              console.log("SAVING MODEL .......");
              await model.save("file://models/" + MODEL_NAME);
              await sleep(1000);
            }
          }

          epoch_counter++;
        },
      },
    });
  }

  async function uploadModelToGoogleCloud(MODEL_NAME) {
    let modeljson = await fs.readFileSync(
      "./models/" + MODEL_NAME + "/model.json"
    );
    let weightsbin = await fs.readFileSync(
      "./models/" + MODEL_NAME + "/weights.bin"
    );

    storage
      .bucket("tradinginsight")
      .file("/models/" + MODEL_NAME + "/" + "model.json")
      .save(modeljson);
    storage
      .bucket("tradinginsight")
      .file("/models/" + MODEL_NAME + "/" + "weights.bin")
      .save(weightsbin);

    console.log("FINISH UPLOADING");
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  train();

  async function testModel() {
    console.log("RESULT DATA ", resultdata);

    // Randomly select 100 indices from the dataset
    const selectedIndices = [];
  
    for (let i = 0; i < resultdata.length;i++){

      if (resultdata[i][0] === 1){
        selectedIndices.push(i);
      }
      if (resultdata[i][1] === 1){
        selectedIndices.push(i);
      }

       if (selectedIndices.length > 100){
        break;
       }


    }

    console.log("Selected Indices: ", selectedIndices);

    for (const index of selectedIndices) {
      const testdata = traindata[index];
      const testresponse = resultdata[index];

      console.log("------------- TESTING -----------------------");
      console.log(" RESPONSE ", testresponse);

      const xsTensor = tf.tensor3d(testdata, [1, 120, 1]); // Reshape to 3D tensor
      console.log(xsTensor.shape);

      try {
        const ys = model.predict(xsTensor); // Predict using the model

        if (ys) {
          const array = await ys.array(); // Await the promise resolution
          const predictedValue = array[0];
          console.log("Predicted:", predictedValue, "Expected:", testresponse);
        } else {
          console.error("Prediction failed: 'ys' is undefined or null.");
        }
      } catch (error) {
        console.error("Error during prediction:", error);
      }
    }
  }
}

async function downloadModelFromGoogleCloud(MODEL_NAME) {
  try {
    await fs.rmdirSync("models/" + MODEL_NAME, { recursive: true });
  } catch (e) {
    console.log("RMDIR ", e);
  }

  try {
    await fs.mkdirSync("models/" + MODEL_NAME);
  } catch (e) {
    console.log("MKDIR ", e);
  }

  const options = {
    destination: "models/" + MODEL_NAME + "/model.json",
  };

  const optionsBin = {
    destination: "models/" + MODEL_NAME + "/weights.bin",
  };

  let modeljson = await storage
    .bucket("tradinginsight")
    .file("/models/" + MODEL_NAME + "/model.json")
    .download(options);

  let weightsbin = await storage
    .bucket("tradinginsight")
    .file("/models/" + MODEL_NAME + "/weights.bin")
    .download(optionsBin);

  console.log(modeljson);
}

function startTraining(FILE) {
  fs.createReadStream("./filter/" + FILE)
    .pipe(csv())
    .on("data", (data) => {
      let data_array = [];
      let result = null;

      Object.keys(data).forEach((key) => {
        if (key.includes("data")) {
          data_array.push(parseFloat(data[key]));
        }

        if (key.includes("label")) {
          result = data[key]; // Store the label as a string
        }
      });

      if (testdata === null) {
        testdata = data_array;
      }
      if (testresponse === null) {
        testresponse = result;
      }

      traindata.push(data_array);
      resultdata.push(result);
    })
    .on("end", () => {
      console.log(traindata.length, resultdata.length);

      console.log("RESULT DATA LABELS ", resultdata);

      // One-hot encode labels
      resultdata = resultdata.map((label) => {
        const oneHot = [0, 0, 0]; // [POSITIVE, NEGATIVE, NEUTRAL]
        if (label === "POSITIVE") oneHot[0] = 1; // POSITIVE
        if (label === "NEGATIVE") oneHot[1] = 1; // NEGATIVE
        if (label === "NEUTRAL") oneHot[2] = 1; // NEUTRAL
        return oneHot;
      });

      // Start training after processing the CSV
      trainModel();
    });
}

function startProcess() {}

startProcess();

function getUserInput() {
  MODEL_NAME = "bttcoin_model";
  rl.close();

  startTraining("total.csv");
}

getUserInput();
