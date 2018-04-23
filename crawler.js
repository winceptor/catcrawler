var router = require('express').Router();

var request = require('request')

const url = require('url');
const cheerio = require('cheerio')

var breaker = "##############################\n";

router.post('/',function(req, res, next){
    //if (!res.locals.hasadmin) { return res.denied("###denied###"); }
    
    var crawlqueue = [];
    var crawldata = {};
    var responsetime = 0;
    
    function queuecrawl(newentry)
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
                crawldata[target] = {queued: true};
                
                crawlqueue.push({target: target, path: path, depth: depth, text: text});
                //console.log("Added to queue (" + depth +  "): "+ target);
            }  
        }

    }
    
    function crawl(data, cb, res)
    {
        var num = data.num || 0;
        var maxdepth = data.maxdepth || 0;
        
        maxdepth = Math.min(maxdepth, 3);
        
        data.num = num+1;

        var entry = crawlqueue.shift();
    
        if (!entry || entry==null)
        {
            var message = "Crawling complete. " + num + " urls crawled. Average response time: " + Math.round(responsetime) + "ms";
            //output += "Crawl entry: ";
            //output += JSON.stringify(crawldata, null, "\t");
    
            //console.log(output);
                console.log(message);
                
            return cb(null, message);
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
            asynccrawl(data, cb, res);
            return;
          }
         
          crawldata[target] = entry;
          responsetime = (responsetime*num+response.elapsedTime)/(num+1);
          
          var message = "" + depth + ":" + num + " (" + crawlqueue.length;
          
          if (maxdepth==depth) {
              message += " left";
          } else {
              message += " queued";
          }
          
          
          message += ")";
          message += " - " + response.elapsedTime + "ms (" + Math.round(responsetime) + "ms avg)";
          message += " - [" + response.statusCode + "]";
          message += " - " + target + "\n";
          res.write(message);
          console.log(message);
          if (response.statusCode!="200") {
              message = breaker;
              message += "Warning! Status code: " + response.statusCode + "\n";
              message += "Target url: " + target + "\n";
              message += "Link text: " + text + "\n";
              message += "Source page: " + path + "\n";
              message += breaker;
              res.write(message);
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
                    
                    
                
                    if (!crawldata[newtarget] && url.parse(target).hostname==url.parse(newtarget).hostname && depth<maxdepth) {
                        var newentry = {};
                        newentry.target = newtarget;
                        newentry.depth = depth+1;
                        newentry.path = target;
                        newentry.text = text;
                        queuecrawl(newentry);
                        
                    }
                    
                }
                
            });
          
            
          }
            asynccrawl(data, cb, res);   
          //console.log('body: ' + body);
        })
    }
    
    function asynccrawl(data, cb, res) {
        setTimeout(function(){ 
             crawl(data, cb, res);
        }, 10);
    }
    
    function startcrawl(data, cb, res) {
        crawlqueue = [];
        crawldata = {};
        responsetime = 0;
        
        queuecrawl(data);
        asynccrawl(data, cb, res);
    }

    var maxdepth = req.body.d || 2;
    var start = req.body.q || "http://" + req.hostname + "/";
    var data = {};
    data.maxdepth = maxdepth;
    data.target = start;
    data.depth = 0;
    data.num = 0;
    data.path = start;
	startcrawl(data, function(err, result) {
	    var apijson = {};
    	apijson.err = err;
    	apijson.result = result;
	    return res.end(result); 
	}, res);
	//next();
	
	req.on("close", function() {
        crawlqueue = [];
        console.log("Request interrupted, user has left the page!");
    });
});

module.exports= router;