// Universal variable for selecting the board
window.board = "";

// Universal variable for manipulating the game
window.game = "";

// Global variable for tracking the number of players in the game
var playerNum = 0;

// Global variable for tracking number of game rooms in lobby
var numberOfRooms = 0;

// Global variable for quickly accessing firebase
var database = "";

// Global variable stores the ID of any online game the player is currently playing
// Empty when player is not playing in a room.
var palyingOnline = "";

// Boolean is true when a chessboard is loaded on the screen
var boardOnScreen = false;

// Boolean is true when chessboard is non-interactive.
var lock = true;

// Boolean is true when microphone is on.
var micOn = false;

// Global array stores sets of coordinates for voice commands
var moveholder = [];

// This array keeps all the possible defeat text.
var defeatText = [
  "Your performance was pathetic.",
  "Evidently, you were grossly outmatched.",
  "Your loss was most shameful.",
  "A fitting loss for one of your caliber.",
  "If I were you, I would crawl inside a hole.",
  "Don't embarrass yourself like that again.",
  "Blunder after blunder...",
  "Disgraceful!"
];

// This array keeps all the possible victory text.
var victoryText = [
  "Peace was never an option.",
  "Victory is rightfully yours.",
  "They never stood a chance.",
  "Well played, well played indeed.",
  "I salute your cunning.",
  "You have my respect.",
  "You clearly possess the superior intellect.",
  "Bravo!"
];

// First order of business: Initialize firebase
// Server intercepts a fetch request asking for Firebase configuration.
// This configuration contains my API key and database url
fetch("/getConfig")
  .then(response => response.json())
  .then(data => {
    // Glitch doesn't recognize firebase, so undefined errors.
    firebase.initializeApp(data);
    database = firebase.database();
    // Call loadStuff, which loads a bunch of important stuff.
    loadStuff();
  })
  .catch(err => {
    console.error("Error getting configuration from server:", err.message);
    database = "Database Error";
  });

// Retrieve data from firebase and use it to load the lobby with the most recent data.
// Lots of firebase asynchronous monitoring will also be initialized here, to update the game when changes occur.
function loadStuff() {
  database.ref("playerNumber").once("value", function(data) {
    // Increment firebase's player count by one
    database.ref("playerNumber").set(data.val() + 1);
  });

  // BEGIN MONITORING PLAYER NUMBER
  database.ref("playerNumber").on("value", function(data) {
    // When more players load the game, update playerNum to match.
    playerNum = data.val();
    // Update player online counter in the lobby to show number of players
    $("#ponline").html("Players Online: " + playerNum);
  });

  // BEGIN MONITORING FOR NEW LOBBY GAME ROOMS
  database.ref("lobby/count").on("value", function(count) {
    // Clear old rooms
    document.getElementById("roomList").textContent = "";
    // update numberOfRooms to match most recent
    numberOfRooms = count.val();
    updateLobby();
  });

  function updateLobby() {
    // Make new rooms
    if (numberOfRooms == 0) {
      // If there are no games, tell the user
      var node = document.createElement("P");
      node.innerHTML = "<b>No available games</b>"; // Set innerHTML
      node.style.paddingLeft = "10px";
      node.style.paddingRight = "10px";
      document.getElementById("roomList").appendChild(node); // Append <span> to <ul>
    } else {
      database.ref("lobby").once("value", function(data) {
        var data = data.val();
        var i;
        for (i = 0; i < numberOfRooms; i++) {
          const game = data[Object.keys(data)[i]];

          // Create div element
          var node = document.createElement("DIV");

          // Create a passcode lock icon, depending on whether the game has a passcode or not
          var icon = document.createElement("SPAN");
          icon.classList.add("material-icons");
          // If the game has no password, set icon to open lock
          if (game.password == "") {
            icon.innerHTML = "lock_open";
          } else {
            // If it does have a password, lock icon
            icon.innerHTML = "lock";
          }
          node.appendChild(icon); // Append the icon to <div>

          // Create a span element containing the name of the game.
          var text = document.createElement("SPAN");
          text.innerHTML = game.name;
          text.setAttribute("class", "nameOfTheGame");
          node.appendChild(text); // Append the text to <div>
          
           // Set an onclick function so that players can join
          text.onclick = function() {
            joinRoom(Object.keys(data)[i - 1]);
          };

          // Create a span element to tell user if room if full or not.
          var capacity = document.createElement("SPAN");
          if (game.bothPlayers == false) {
            capacity.innerHTML = "1/2";
          } else {
            capacity.innerHTML = "2/2";
          }
          capacity.setAttribute("class", "capacityOfTheGame");
          node.appendChild(capacity); // Append the capacity to <div>

          // Create a span element containing the time of the game.
          if (game.seconds.toString().length < 2) {
            game.seconds = "0" + game.seconds;
          }
          var time = document.createElement("SPAN");
          time.innerHTML = game.minutes + ":" + game.seconds;
          time.setAttribute("class", "timeOfTheGame");
          node.appendChild(time); // Append the time to <div>

          // Finally, we have the finishd product
          document.getElementById("roomList").appendChild(node); // Append <div> to roomList
        }
      });
    }
  }
}

// create a new game room
function createRoom() {
  var gameName = document.getElementById("submitName").value.trim();
  const gamePass = document.getElementById("submitPass").value.trim();
  var min = document.getElementById("submitMin").value.trim();
  var sec = document.getElementById("submitSec").value.trim();
  const player = "white";

  // If no name is given, make game anonymous
  if (gameName == "") {
    gameName = "Unnamed Game";
  }

  if (sec == "") {
    sec = 0;
  }

  if (min == "") {
    min = 0;
  }

  // Converts smaller units to larger ones and store the leftovers (found using modulus) in new variables.
  // For example, if 120 seconds were selected, it would be converted into an additional 2 minutes.
  var seconds = sec % 60;
  var minutes = parseInt(min) + Math.floor(sec / 60);

  // If les sthan 2 minutes were set, stop execution and scold the user.
  if (minutes < 2) {
    document.getElementById("scold").style.display = "block";
    return;
  }

  // Generate data to declare game
  var postData = {
    name: gameName,
    minutes: minutes,
    seconds: seconds,
    turn: player,
    move: "",
    bothPlayers: false,
    password: gamePass
  };

  // Get a key for a new Post.
  var newPostKey = database
    .ref()
    .child("lobby")
    .push().key;

  // Write the new post's data simultaneously in the posts list and the user's post list.
  var updates = {};
  updates["/lobby/" + newPostKey] = postData;
  database.ref().update(updates);

  // Update lobby count
  database.ref("lobby/count").set(numberOfRooms + 1);

  // Take the player to their room and await an opponent
  fade("#lobby", "#board");
  boardOnScreen = true;
  lock = true;
  loadGame("multi", newPostKey, player, minutes, seconds);
}


function soloMode() {
  fade("#selection", "#board");
  fade("#selection", "#controls");
  fade("#selection", "#status");
  loadGame("solo", 0, "white", 0, 0);
}

// Join a room
function joinRoom(roomId) {
  fade("#lobby", "#board");
  console.log("JOINED NEW ROOM: " + roomId);
  database.ref("lobby/" + roomId).once("value", function(data) {
    //Get stuff from here;
  });
  loadGame("multi", roomId, "black", 0, 0);
}


// Load a Multiplayer or Solo game
function loadGame(mode, roomId, player, minutes, seconds) {
  // hide lobby lighthouse 
  $('#lobbylightbox').hide();
  //  scold.
  $('#scold').hide();
  
  boardOnScreen = true;
  lock = false;
  // Reload any old games
  window.board = null;
  window.game = null;
  // Glitch does not recognize chess.js
  window.game = new Chess();

  // If this is a solo game, configure board as such
  if (mode === "solo") {
    console.log("Loading Solo Game");
  } else {
    // If mulitplayer game inside a lobby room, configure board as such
    console.log("Loading Multiplayer Game");
    database.ref("lobby/" + roomId + "/move").on("value", function(data) {
      if (roomId != 0 || time != 0) {
        database.ref("lobby/" + roomId + "/move").once("value", function(move) {
          const opponentMove = move.val();
          database
            .ref("lobby/" + roomId + "/turn")
            .once("value", function(turn) {
              const playerTurn = turn.val();
              if (opponentMove != "" && player == playerTurn) {
                let array = opponentMove.split("");
                const source = array[0] + array[1];
                const target = array[2] + array[3];
                // Finally, make the move
                window.game.move({
                  from: source,
                  to: target,
                  promotion: "q"
                });
                window.board.position(window.game.fen());
                // Udpate status
                // updateStatus();
              }
            });
        });
      }
    });
  }

  var config = {
    draggable: true,
    position: "start",
    onDragStart: onDragStart,
    onDrop: onDrop,
    onMouseoutSquare: onMouseoutSquare,
    onMouseoverSquare: onMouseoverSquare,
    onSnapEnd: onSnapEnd
  };

  // Glitch does not recognize chessboard.js
  window.board = Chessboard("board", config);

  // Flip the board if player plays black
  if (player == "black") {
    window.board.flip();
  }

  // set dragging rules and positioning. White is not allowed to touch black's pieces, and so forth.
  function onDragStart(source, piece, position, orientation) {
    // do not pick up pieces if the game is over
    if (window.game.game_over()) return false;

    // only pick up pieces if not locked
    // only pick up pieces if its your turn
    // only pick up your own pices
    if (lock != false) {
      return false;
    } else if (
      (window.game.turn() === "w" && piece.search(/^b/) !== -1) ||
      (window.game.turn() === "b" && piece.search(/^w/) !== -1)
    ) {
      return false;
    } else if (
      (player == "black" && piece.search(/^w/) !== -1) ||
      (player == "white" && piece.search(/^b/) !== -1)
    ) {
      return false;
    }
  }

  // When piece gets dropped
  function onDrop(source, target) {
    removeGreySquares();
    // see if the move is legal
    var move = window.game.move({
      from: source,
      to: target,
      promotion: "q" // NOTE: always promote to a queen for example simplicity
    });

    // illegal move
    if (move === null) return "snapback";

    if (mode == "solo") {
      computerTurn();
    } else {
      var turn = "white";
      if (window.game.turn() === "b") {
        turn = "black";
      }
      database.ref("lobby/" + roomId + "/move").set(source + target);
      database.ref("lobby/" + roomId + "/turn").set(turn);
    }
    // updateStatus();
  }

  // Highlight all possible moves on hover
  function onMouseoverSquare(square, piece) {
    // get list of possible moves for this square
    var moves = window.game.moves({
      square: square,
      verbose: true
    });

    // exit if there are no moves available for this square,
    // or if black chooses a white piece
    // or if white chooses a black piece
    // or if locked
    if (
      lock == true ||
      moves.length === 0 ||
      (player == "black" && piece.search(/^w/) !== -1) ||
      (player == "white" && piece.search(/^b/) !== -1)
    )
      return;

    // highlight the square they moused over
    greySquare(square);

    // highlight the possible squares for this piece
    for (var i = 0; i < moves.length; i++) {
      greySquare(moves[i].to);
    }
  }

  function onMouseoutSquare(square, piece) {
    // Only remove Grey Squares if game is unlocked
    if (lock == true) return;
    removeGreySquares();
  }

  // update the board position after the piece snap
  // for castling, en passant, pawn promotion
  function onSnapEnd() {
    window.board.position(window.game.fen());
  }

  // updateStatus();
}

// 242424
// Updates current game status
function updateStatus() {
  var $status = $("#status");
  var $fen = $("#fen");
  var status = "";

  var moveColor = "White";
  if (window.game.turn() === "b") {
    moveColor = "Black";
  }

  // checkmate?
  if (window.game.in_checkmate()) {
    status = "Game over, " + moveColor + " is in checkmate.";
  }

  // draw?
  else if (window.game.in_draw()) {
    status = "Game over, drawn position";
  }

  // game still on
  else {
    status = moveColor + " to move";

    // check?
    if (window.game.in_check()) {
      status += ", " + moveColor + " is in check";
    }
  }

  var fen = window.game.fen();
  $status.html(status);
  $fen.html(fen);
}

// Highlights all possible moves with a greyish-blue tint
function greySquare(square) {
  // These are the highlight colors for legal moves
  const whiteSquareGrey = "#a5b4cb";
  const blackSquareGrey = "#6390b5";

  var $square = $("#board .square-" + square);

  let background = whiteSquareGrey;
  if ($square.hasClass("black-3c85d")) {
    background = blackSquareGrey;
  }

  $square.css("background", background);
}

// Romoves all highlights
function removeGreySquares() {
  $("#board .square-55d63").css("background", "");
}

// Computer takes turn
function computerTurn() {
  var fen = window.game.fen();
  // To account for differences in FEN coding, I insert my own convertion here to
  // make my board readable to the API.
  if (fen.split(" ").length > 4) {
    var fenarray = fen.split(" ");
    fen =
      fenarray[0] +
      " " +
      fenarray[1] +
      " " +
      fenarray[2] +
      " - " +
      fenarray[4] +
      " " +
      fenarray[5];
  }

  // format the data we want to pass to the server as JSON
  const data = { fen: fen };
  fetch("/nextMove", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" }
  })
    .then(response => response.json())
    .then(data => {
      // get the response from the server
      // Check for API errors. If the data is not undefined (error), make the move.
      if (typeof data.pvs !== "undefined") {
        console.log("RESPONSE FROM SERVER RECIEVED");
        // Format the response to only show next best move.
        const solution = data.pvs[0].moves.split(" ")[0];

        // Reformat the solution to make it feed it to the chessboard
        let array = solution.split("");
        const source = array[0] + array[1];
        const target = array[2] + array[3];
        // Finally, make the move
        window.game.move({
          from: source,
          to: target,
          promotion: "q"
        });
        window.board.position(window.game.fen());
        // Udpate status
        // updateStatus();
      } else {
        // If no moves were found, generate a random move.
        console.log(
          "ERROR. API FAILED TO PROVIDE RESPONSE. GENERATING RANDOM MOVE."
        );

        // window.game.moves() generates all VALID moves possible in current position.
        var possibleMoves = window.game.moves();

        // if no moves are available, the game must be over.
        if (possibleMoves.length === 0) {
          return;
        }

        // Select a random move out of all possibilities
        var randomIdx = Math.floor(Math.random() * possibleMoves.length);
        // Perform the move
        const newmove = possibleMoves[randomIdx];
        window.game.move(newmove, { promotion: "q" });
        window.board.position(window.game.fen());
      }
    });
}

// User turns mic on
function micPress() {
  // If voice commands are not supported, kindly inform the user
  if (!("webkitSpeechRecognition" in window)) {
    alert("Speech Recognition is not supported for your browser.");
  } else {
    if (micOn == false) {
      micOn = true;
      $("#mic").css("background-color", "white");
      $("#mic").html("mic");
      $("#vcActive").html("Enabled");
      record();
    } else {
      micOn = false;
      $("#mic").css("background-color", "#ddd");
      $("#mic").html("mic_off");
      $("#vcActive").html("Disabled");
      window.recognition.stop();
      // Aside from this, also clear moveholder array, unlock game, and clear all possible highlights
      lock = false;
      if (moveholder.length != 0) {
        removeGreySquares();
        $("#board .square-" + moveholder[0]).removeClass("highlight1-32417");
        moveholder = [];
      }
    }
  }
}

// Placeholder until I can get voice-to-text figured out
function record() {
  // Audio collection
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    window.recognition = new webkitSpeechRecognition();
    window.recognition.continuous = false;
    window.recognition.lang = "en-US";
    window.recognition.interimResults = false;
    window.recognition.start();

    window.recognition.onresult = function(event) {
      // Meticulous checking for proper moves
      var transcript = event.results[0][0].transcript.toLowerCase();
      // common errors
      if (transcript == "1/8") {
        transcript = "a8";
      } else if (transcript == "before") {
        transcript = "b4";
      }
      console.log("RECOGNIZED: " + transcript);
      window.recognition.abort();
      // check that transcript contains at least one number, one letter from a-h, and has a max length of 2 characters
      if (
        (transcript.includes("a") == true ||
          transcript.includes("b") == true ||
          transcript.includes("c") == true ||
          transcript.includes("d") == true ||
          transcript.includes("e") == true ||
          transcript.includes("f") == true ||
          transcript.includes("g") == true ||
          transcript.includes("h")) &&
        /\d/g.test(transcript) == true &&
        transcript.length < 3
      ) {
        // Player takes a turn
        voiceCommand(transcript);
      }
      record();
    };
  });
}

function voiceCommand(t) {
  // Push the value into a place holder array
  moveholder.push(t);

  // There are 2 possible scenarios. Either this is the first coordinate for the source, or the second one of the target.
  // If this is the first coordinate, highlight all possible moves for the piece selected
  if (moveholder.length == 1) {
    // get list of possible moves for this square
    var moves = window.game.moves({
      square: moveholder[0],
      verbose: true
    });

    // If there are no legal moves
    if (moves.length === 0) {
      console.log("ZERO POSSIBLE MOVES");
      // Reset the array containing coords
      moveholder = [];
    } else {
      // If legal moves exist for this piece
      // highlight the square they selected
      greySquare(moveholder[0]);
      $("#board .square-" + moveholder[0]).addClass("highlight1-32417");

      // highlight the possible squares for this piece
      for (var i = 0; i < moves.length; i++) {
        greySquare(moves[i].to);
      }

      // Prevent player from using chessboard, since this messes up previous highlighting
      lock = true;
    }
  } else if (moveholder.length == 2) {
    // If there are two successful coordinates, call a function to set them as player moves,
    // then empty moveholder to make room for new moves
    const source = moveholder[0];
    const target = moveholder[1];

    // remove highlights
    removeGreySquares();
    $("#board .square-" + moveholder[0]).removeClass("highlight1-32417");

    // validate the move
    let move = window.game.move({
      from: source,
      to: target,
      promotion: "q"
    });
    if (move === null) {
      console.log("INVALID MOVE");
    } else {
      window.board.position(window.game.fen());
      // Udpate status
      // updateStatus();
      // Computer takes a turn
      computerTurn();
    }
    // Reset the array containing coords
    moveholder = [];

    // Unlock the game
    lock = false;
  }
}

// Fadein and exit functions are responisble for navigation
// Changes screens by fading in and out
function fade(x, y) {
  // Disable clicking to prevent button pressing during animation
  $("#page-container").css("pointer-events", "none");

  // Fadeout x, then fadein y
  // Use jQuery to select x and make it fade out.
  $(x).css({
    visibility: "hidden",
    opacity: "0",
    transition: "visibility 500ms ease, opacity 500ms ease"
  });

  setTimeout(function() {
    //Enable clicking
    $("#page-container").css("pointer-events", "auto");

    // Hide x
    $(x).hide();
    // Load y once fadeout animation is done
    $(y).show();

    load();
  }, 600);

  function load() {
    // fadein y
    $(y).css({
      visibility: "visible",
      opacity: "1",
      transition: "visibility 500ms ease, opacity 500ms ease"
    });
  }
}

// Exiting a board requires updating boardOnSceen and Lock variables
function exitBoard(location) {
  $("#flip").css("background-color", "#111");
  boardOnScreen = false;
  lock = true;
  if (location == "solo") {
    fade("#board", "#selection");
    fade("#controls", "#selection");
    fade("#status", "#selection");
  } else {
  }
}

// trims input to only allow two characters at a time
function crop(target) {
  if (target.className == "setText") {
    target.value = target.value.slice(0, 15);
  } else {
    target.value = target.value.slice(0, 2);
  }
}

// Flip the board around
function flipBoard() {
  const current = window.game.turn();
  if (current == "w") {
    loadGame("solo", "0", "black", 0, 0);
    computerTurn();
    $("#flip").css("background-color", "#eee");
  } else {
    loadGame("solo", "0", "white", 0, 0);
    $("#flip").css("background-color", "#111");
  }
}

// Reset solo board
function resetBoard() {
  const current = window.game.turn();
  if (current == "w") {
    loadGame("solo", "0", "white", 0, 0);
  } else {
    loadGame("solo", "0", "black", 0, 0);
    computerTurn();
  }
}

// When the screen size changes, adjust Chessboard to match
function screenResized() {
  if (boardOnScreen == true) {
    var config = {
      draggable: true,
      position: "start"
    };
    window.board = Chessboard("board", config);
  }
}

// When window has loaded, perform the following tasks:
window.onload = function() {
  fade("#selection", "#lobby");
};

// Lighthouse doesn't recommend onunload. This is their adaptive solution:
// If browser supports pagehide, use it. If not, use onunload.
const terminationEvent = "onpagehide" in self ? "pagehide" : "unload";

// fires when the window is closed or reloaded
addEventListener(
  terminationEvent,
  event => {
    // Note: if the browser is able to cache the page, `event.persisted`
    // is `true`, and the state is frozen rather than terminated.

    // When player leaves game, decrease playerNum by 1
    database.ref("playerNumber").set(playerNum - 1);
  },
  { capture: true }
);
