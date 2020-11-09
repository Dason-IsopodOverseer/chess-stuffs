const express = require("express");
const app = express();
const fetch = require("node-fetch");

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/public/index.html");
});

// needed to prevent CORS errors
app.use((req, res, next) => {
  console.log("CORS Error Check");
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Followed glitch instructions to send json back and forth between server and client
// I don't know what body parser is, but my server cannot interpret fetch POST without it.
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Body parser enables the following code:
app.post("/nextMove", function(request, response) {
  // Retrieve the fen sent by client side
  const requestedFen = request.body.fen;
  // Plug it into the url for a fetch request
  const url = "https://lichess.org/api/cloud-eval?fen=" + requestedFen;
  // Set headers for the request, including secret key
  const userParam = {
    headers: {
      Authorization: "Bearer " + process.env.API_KEY
    },
    method: "GET"
  };

  fetch(url, userParam) // Call the fetch function passing the url and AKI key as parameters
    .then(response => response.json())
    .then(data => {
      // Send the data back to client side
      response.json(data);
    })
    .catch(function(error) {
      console.log("ERROR CAUGHT:");
      console.log(error);
    });
});

// Using your secure key example, I send my firebase configuration to client end
// after retriving it from .env from server
app.get("/getConfig", fetchConfig);

function fetchConfig(req, response) {
  // Get my firebase apiKey and app ID
  var config = {
    apiKey: process.env.FIREBASE_KEY,
    authDomain: "vcchess.firebaseapp.com",
    databaseURL: process.env.DATABASE_URL,
    projectId: process.env.APP_ID,
    storageBucket: process.env.APP_ID + ".appspot.com",
    appId: process.env.FIREBASE_ID
  };
  response.json(config);
}

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
