//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var path = require('path');

var async = require('async');
var socketio = require('socket.io');
var express = require('express');

var bodyParser = require('body-parser');


var request = require('request')

const url = require('url');
const cheerio = require('cheerio')

var breaker = "##############################\n";
breaker = "";

//
// ## SimpleServer `SimpleServer(obj)`
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var app = express();
//var server = http.createServer(router);
var server = http.createServer(app);
var io = socketio.listen(server);

var crawler = require('./crawler');

app.use(bodyParser.json()); // get information from html forms
//app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));

app.use(crawler);

app.use(express.static(path.resolve(__dirname, 'client')));

app.get('/',function(req, res, next){
    res.sendFile(path.join(__dirname+'/index.html'));
	next();
});

var messages = [];
var sockets = [];

io.on('connection', function (socket) {
    

    //messages.forEach(function (data) {
      //socket.emit('message', data);
    //});

    sockets.push(socket);
    
    var data = {text: "Waiting...", ready: true};
    socket.emit('status', data);

    socket.on('disconnect', function () {
      stopcrawl(data, socket);
      sockets.splice(sockets.indexOf(socket), 1);
      //updateRoster();
    });
    
    socket.on('crawlrequest', function (crawldata) {
      var data = {};
      data.maxdepth = crawldata.depth;
      data.target = crawldata.url;
      data.depth = 0;
      data.num = 0;
      data.path = crawldata.url;
    	startcrawl(data, socket);
    });
        
    socket.on('crawlabort', function (data) {
    	stopcrawl(data, socket);
    });
    

    /*
    socket.on('message', function (msg) {
      var text = String(msg || '');

      if (!text)
        return;

      socket.get('name', function (err, name) {
        var data = {
          name: name,
          text: text
        };

        broadcast('message', data);
        messages.push(data);
      });
    });
    */
    
    socket.on('identify', function (name) {
      //socket.set('name', String(name || 'Anonymous'), function (err) {
        //updateRoster();
      //});
    });
  });
   
    
function queuecrawl(newentry, socket)
{
   
    //crawl(target, dmax, depth+1);
    var target = newentry.target;
    var path = newentry.path;
    var depth = newentry.depth;
    var text = newentry.text;


    if (target && target!=null)
    {
        
        
        var urlsplit = target.split("://");
        if (urlsplit.length>1)
        //if (target && target[0]=="/")
        {
            socket.crawldata[target] = {queued: true};
            
            socket.crawlqueue.push({target: target, path: path, depth: depth, text: text});
            //console.log("Added to queue (" + depth +  "): "+ target);
        }  
    }

}

function crawl(data, socket)
{
    var num = data.num || 0;
    var maxdepth = data.maxdepth || 0;
    
    maxdepth = Math.min(maxdepth, 3);
    maxdepth = Math.max(maxdepth, 1);
    
    data.num = num+1;

    var entry = socket.crawlqueue.shift();
    

    if (!entry || entry==null)
    {
        var message = "Crawling complete: " + num + " urls - " + Math.round(socket.responsetime) + "ms avg - " + socket.warnings + " warnings. ";
        //output += "Crawl entry: ";
        //output += JSON.stringify(crawldata, null, "\t");

        //console.log(output);
            console.log(message);
            
        
        socket.emit("message", {text: message});
        socket.emit("status", {text: message, ready: true});
        return false;
    }
    
    var target = entry.target;
    var path = entry.path;
    var depth = entry.depth;
    var text = entry.text;
    
    
    
    //var n = depth || 0;
    //console.log("(" + num + "): " + path);
    //var target = 'http://www.google.com' // input your url here
    
    // use a timeout value of 10 seconds
    var timeoutInMilliseconds = 10*1000;
    var opts = {
      uri: target,
      timeout: timeoutInMilliseconds,
      time : true
    }
    
    request(opts, function (err, response, body) {
      if (err) {
        console.dir(err);
        asynccrawl(data, socket);
        return;
      }
     
      socket.crawldata[target] = entry;
      socket.responsetime = (socket.responsetime*num+response.elapsedTime)/(num+1);
      
      var message = "" + depth + ":" + num + " (" + socket.crawlqueue.length;
      
      if (maxdepth==depth) {
          message += " left";
      } else {
          message += " queued";
      }
      
      
      message += ")";
      message += " - " + response.elapsedTime + "ms (" + Math.round(socket.responsetime) + "ms avg)";
      
      message += " - " + socket.warnings + " warnings";
      message += "\n[" + response.statusCode + "]";
      message += " - " + target + "\n";
      //res.write(message);
      socket.emit("status", {text: message});
      console.log(message);
      if (response.statusCode!="200") {
          message = breaker;
          message += "Warning! Status code: <b>" + response.statusCode + "</b>\n";
          message += "Target url: <a href='" + target + "' target='_blank'>" + target + "</a>\n";
          message += "Link text: <b>" + text + "</b>\n";
          message += "Source page: <a href='" + path + "' target='_blank'>" + path + "</a>\n";
          message += breaker;
          
          
          socket.warnings = socket.warnings + 1;
          
          socket.emit("message", {text: message});
            console.log(message);
      }
      
      if (response.headers && response.headers['content-type'] && response.headers['content-type'].split(";")[0] =="text/html")
      {
        var parsed = cheerio.load(body, {
            withDomLvl1: true,
            normalizeWhitespace: false,
            xmlMode: false,
            decodeEntities: true
        });
        parsed( "a" ).each(function( index, value ) {
            var link = parsed( this );
            var href = link.attr('href');
            var text = link.text();
            //console.log( index + ": " + href );
            if (href) {
                var newtarget = url.resolve(target, href);
                
                
            
                if (!socket.crawldata[newtarget] && url.parse(target).hostname==url.parse(newtarget).hostname && depth<maxdepth) {
                    var newentry = {};
                    newentry.target = newtarget;
                    newentry.depth = depth+1;
                    newentry.path = target;
                    newentry.text = text;
                    queuecrawl(newentry, socket);
                    
                }
                
            }
            
        });
      
        
      }
        asynccrawl(data, socket);   
      //console.log('body: ' + body);
    })
}

function asynccrawl(data, socket) {
    setTimeout(function(){ 
         crawl(data, socket);
    }, 10);
}


function startcrawl(data, socket) {
    socket.crawlqueue = [];
    socket.crawldata = {};
    socket.responsetime = 0;
    socket.warnings = 0;
    
    data.maxdepth = data.maxdepth || 1;
    
    queuecrawl(data, socket);
    asynccrawl(data, socket);
    
    var data = {text: "Working..."};
    socket.emit('status', data);
}
  

function stopcrawl(data, socket) {
  if (socket.crawlqueue && socket.crawlqueue.length>0) {
    socket.crawlqueue = [];
    var data = {text: "Working..."};
    socket.emit('status', data);
  } else {
    var data = {text: "Ready", ready: true};
    socket.emit('status', data);
  }

}
 

/*
function updateRoster() {
  async.map(
    sockets,
    function (socket, callback) {
      socket.get('name', callback);
    },
    function (err, names) {
      broadcast('roster', names);
    }
  );
}
*/

function broadcast(event, data) {
  sockets.forEach(function (socket) {
    socket.emit(event, data);
  });
}


server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Crawl server listening at", addr.address + ":" + addr.port);
});
