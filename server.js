var unirest = require('unirest');
var express = require('express');
var events = require('events');

var app = express();
app.use(express.static('public'));

var getFromApi = function(endpoint, args){
  var emitter = new events.EventEmitter();
  unirest.get('https://api.spotify.com/v1/'+endpoint)
    .qs(args)
    .end(function(response){
      if(response.ok){
        emitter.emit('end', response.body);
      }
      else{
        emitter.emit('error', response.code);
      }
    });
  return emitter;
};
//https://api.spotify.com/v1/search?q=john&limit=1&type=artist
app.get('/search/:name', function(req, res){
  var searchReq = getFromApi('search', {
    q: req.params.name,
    limit: 1,
    type: 'artist'
  });
  
  searchReq.on('end', function(item){
    var artist = item.artists.items[0];
    var relatedArtists = getFromApi('artists/' + artist.id + '/related-artists');
    relatedArtists.on('end', function(related){
      artist.related = related.artists;
      var pendingRequests = artist.related.length;
      artist.related.forEach(function(item){
        var topTracks = getFromApi('artists/' + item.id + '/top-tracks', {country:'us'});
        topTracks.on('end', function(response){
          item.tracks = response.tracks;
          pendingRequests--;
          if (pendingRequests === 0){
            res.json(artist);
          }
        });
        topTracks.on('error', function(code){
          pendingRequests--;
          item.tracks = [];
          if(pendingRequests === 0){
            res.json(artist);
          }
        });
      });
    });
    relatedArtists.on('error', function(code){
      res.sendStatus(code);
    });
    
  });
  
  searchReq.on('error', function(code){
    res.sendStatus(code);
  });
});

app.listen(process.env.PORT || 8080);
