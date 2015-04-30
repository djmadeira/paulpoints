var Twit = require('twit');
var mongoose = require('mongoose');

var T = new Twit({
  consumer_key:         process.env.TWIT_CONSUMER_KEY,
  consumer_secret:      process.env.TWIT_CONSUMER_SECRET,
  access_token:         process.env.TWIT_ACCESS_TOKEN,
  access_token_secret:  process.env.TWIT_ACCESS_TOKEN_SECRET
});

mongoose.connect(process.env.MONGOLAB_URI);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

var userText = {
  help: 'commands: points (display points)'
};
var mode7Text = {
  help: 'commands (mode7 only): award <number> <user>, deduct <number> <user>'
}

var userSchema = mongoose.Schema({
  screen_name: String,
  points: Number,
  prestige: Number
});

userSchema.methods.awardPoints = function (points) {
  this.points += points;
  return this.points;
};

var User = mongoose.model('User', userSchema);

function app () {
  var stream = T.stream('user');

  stream.on('tweet', function (tweet) {
    if (tweet.user.id === 3224450463) {
      return;
    }

    var args = tweet.text.split(' ');
    console.log(tweet);
    console.log(args);

    var response = '@' + tweet.user.screen_name + ' ';

    if (tweet.user.screen_name === process.env.MODE7HANDLE) {
      switch(args[1]) {
        case 'help':
          getHelpText(tweet, response, tweetResponse);
          break;
        case 'award':
          awardPoints(tweet, args, response, tweetResponse);
          break;
        case 'deduct':
          awardPoints(tweet, args, response, tweetResponse);
          break;
        case 'points':
          getPoints(tweet, response, tweetResponse);
          break;
        default:
          tweetResponse(response + 'usage: @paul_points command [args] ("help" for a list of commands)');
      }
    } else {
      switch (args[1]) {
        case 'help':
          getHelpText(tweet, response, tweetResponse);
          break;
        case 'points':
          getPoints(tweet, response, tweetResponse);
          break; 
        default:
          tweetResponse(response + 'usage: @paul_points command [args] ("help" for a list of commands)');
      }
    }
  });
}

function tweetResponse(response) {
  T.post('statuses/update', {status: response}, function(err, data, response) {
    if (err) {
      console.error(err);
    }
  });
}

function getHelpText(tweet, response, cb) {
  if (tweet.user.screen_name === process.env.MODE7HANDLE) {
    response += mode7Text.help;
  } else {
    response += userText.help;
  }

  cb(response);
}

var responseData = {
  response: '',
  callback: null,
  screenName: '',
  points: 0
};

function getPoints(tweet, response, cb) {
  response += ' points: ';
  responseData.callback = cb;
  responseData.response = response;

  User.findOne({screen_name: tweet.user.screen_name}, function (err, result) {
    if (err) {
      console.error(err);
    }

    if (!result) {
      return responseData.callback(responseData.response + '0.');
    }

    responseData.callback(responseData.response + result.points);
  });
}

function savePoints(err, result) {
  if (!result) {
    var user = new User({screen_name: responseData.screenName, points: responseData.points});
    user.save();
  } else {
    result.awardPoints(responseData.points);
    result.save();
  }
}

function awardPoints(tweet, args, response, cb) {
  var points = parseInt(args[2]);
  if (args.length !== 4 || !points) {
    return cb(response + 'when is SYNTAX ERROR announced for smash bros');
  }
  
  var screenName = (args[3].indexOf('@') === 0 ? args[3].substring(1) : args[3]);  

  response += '@'+ screenName +(args[1] === 'deduct' ? ' deducted ' : ' awarded ')+ points +' points.';

  points = (args[1] === 'deduct' ? -points : points);

  responseData.screenName = screenName;
  responseData.points = points;

  User.findOne({screen_name: screenName}, savePoints);

  cb(response);
}

db.once('open', app);