var router = require('express').Router();

var request = require('request')

const url = require('url');
const cheerio = require('cheerio')


router.use(function(req, res, next) {
    //nothing
	
	next();
});


router.post('/crawl',function(req, res, next){
    //if (!res.locals.hasadmin) { return res.denied("###denied###"); }
    
    var crawlqueue = [];
    var crawldata = {};
    var responsetime = 0;
    
    function queuecrawl(data)
    {
       
        //crawl(target, dmax, depth+1);
        var target = data.target;
        var path = data.path;
        var depth = data.depth;
        var maxdepth = data.maxdepth;
        
        if (depth<maxdepth) {
            if (target && target!=null)
            {
                
                
                var urlsplit = target.split("://");
                if (urlsplit.length>1)
                //if (target && target[0]=="/")
                {
                    crawldata[target] = {queued: true};
                    
                    if (path) {
                        path = path + "->" + target;
                    }
                    else
                    {
                        path = target;
                    }
                    crawlqueue.push({target: target, path: path, depth: depth});
                    //console.log("Added to queue (" + n + "/" + m + "): "+ target);
                }  
            }
     
        }
    }
    
    function crawl(data, cb, res)
    {
    
        var entry = crawlqueue.shift();
    
        if (!entry || entry==null)
        {
            var output = "Crawling complete. " + entry.num + " urls crawled. ";
            //output += "Crawl entry: ";
            //output += JSON.stringify(crawldata, null, "\t");
    
            //console.log(output);
            return cb(null, output);
        }
        
        var target = entry.target;
        var path = entry.path;
        var depth = entry.depth;
        
        var n = depth || 0;
        //console.log("(" + n + "): " + path);
        //var target = 'http://www.google.com' // input your url here
        
        // use a timeout value of 10 seconds
        var timeoutInMilliseconds = 10*1000
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
          var statusCode = response.statusCode;
          //console.log('response: ');
          //response.body = null;
          //console.log(response);
          //console.log(response.headers['content-type']);
          var data = response.client;
          var storedata = {};
          
          
          
          if (crawldata[target] && !crawldata[target].queued)
          {
                
              storedata = crawldata[target];
              
              
              storedata.path = path;
              //storedata.averageloadtime = Math.round( (storedata.averageloadtime*(storedata.hits)+data._idleStart)/(storedata.hits+1) );
              storedata.averageresponse = Math.round( (storedata.averageresponse*(storedata.hits)+response.elapsedTime)/(storedata.hits+1) );
              storedata.hits = storedata.hits + 1;
              
          }
          else
          {
                
                storedata.path = path;
                //storedata.averageloadtime = data._idleStart;
                storedata.averageresponse = response.elapsedTime;
                storedata.hits = 1;
                //storedata.queued = null;
          }
          crawldata[target] = storedata;
          
          res.write("(" + n + " - " + response.elapsedTime + "ms) " + path + "\n");
          
          if (response.headers && response.headers['content-type'] && response.headers['content-type'].split(";")[0] =="text/html")
          {
            var parsed = cheerio.load(body, {
                withDomLvl1: true,
                normalizeWhitespace: false,
                xmlMode: false,
                decodeEntities: true
            });
            parsed( "a" ).each(function( index, value ) {
                var href = parsed( this ).attr('href');
                //console.log( index + ": " + href );
                if (href) {
                    var newtarget = url.resolve(target, href);
                    
                    
                
                    if (!crawldata[newtarget] && url.parse(target).hostname==url.parse(newtarget).hostname) {
                        data.depth++;
                        queuecrawl(data);
                        
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
        queuecrawl(data);
        asynccrawl(data, cb, res);
    }
    
    //startcrawl("http://cyberlab-winceptor.c9users.io/", 10);
    //startcrawl("https://download.mozilla.org/?product=firefox-53.0.2-SSL&os=win64&lang=fi", 100);
    
        
    var depth = req.body.d || 1;
    var start = req.body.q || "http://" + req.hostname + "/";
    var data = {};
    data.maxdepth = depth;
    data.target = start;
	startcrawl(data, function(err, result) {
	    var apijson = {};
    	apijson.err = err;
    	apijson.result = result;
	    return res.end(result); 
	}, res);
	//next();
});

module.exports= router;