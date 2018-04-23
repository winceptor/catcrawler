var request = require('request')

const cheerio = require('cheerio')

var crawlqueue = [];
var crawldata = {};

function queuecrawl(url, n, m)
{
   
    //crawl(url, dmax, depth+1);
    if (n<m) {
        if (url && url!=null)
        {
            var urlsplit = url.split("://");
            if (urlsplit.length>1)
            {
                crawlqueue.push(url);
                //console.log("Added to queue (" + n + "/" + m + "): "+ url);
            }  
        }
 
    }
}

function crawl(n, m)
{

    var url = crawlqueue.shift();
    
    if (!url || url==null)
    {
        console.log("Crawling complete. " + n + " urls crawled.");
        console.log("Crawl data: ");
        console.log(crawldata);
        return;
    }
    
    var n = n || 0;
    console.log("Crawling (" + n + "): " + url);
    //var url = 'http://www.google.com' // input your url here
    
    // use a timeout value of 10 seconds
    var timeoutInMilliseconds = 10*1000
    var opts = {
      url: url,
      timeout: timeoutInMilliseconds
    }
    
    request(opts, function (err, res, body) {
      if (err) {
        console.dir(err);
        asynccrawl(n+1, m);
        return
      }
      var statusCode = res.statusCode;
      //console.log('response: ');
      //res.body = null;
      //console.log(res);
      //console.log(res.headers['content-type']);
      var data = res.client;
      var storedata = {};
      if (crawldata[data._host])
      {
            
          storedata = crawldata[data._host];
          storedata.hits = storedata.hits + 1;
          //storedata.time = Math.round( (storedata.time + data._idleStart) / 2);
          storedata.src = storedata.src + "; " + url;
          
      }
      else
      {
            storedata.hits = 1;
            storedata.src = url;
            //storedata.time = data._idleStart;
      }
      crawldata[data._host] = storedata;
      
      if (res.headers && res.headers['content-type'] && res.headers['content-type'].split(";")[0] =="text/html")
      {
        var parsed = cheerio.load(body);
        parsed( "a" ).each(function( index ) {
          //console.log( index + ": " + parsed( this ).attr('href') );
          var target = parsed( this ).attr('href');
          queuecrawl(target, n, m);
        });
      
        
      }
        asynccrawl(n+1, m);   
      //console.log('body: ' + body);
    })
}

function asynccrawl(n, m) {
    setTimeout(function(){ 
         crawl(n, m);
    }, 100);
}

function startcrawl(url, max) {
    queuecrawl(url, 0, max);
    asynccrawl(0, max);
}

startcrawl("http://cyberlab-winceptor.c9users.io/", 10);
//startcrawl("https://download.mozilla.org/?product=firefox-53.0.2-SSL&os=win64&lang=fi", 100);
