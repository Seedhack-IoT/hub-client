var keygen = require('ssh-keygen');
var fs = require('fs');
var Connection = require('ssh2');
var keyDir = __dirname+'/keys';
var sshKey = keyDir + '/foo_rsa';
var comment = 'device_name';
var password = false;
var haiku = require('./haiku.js');
var polo = require("polo");
var apps = polo();

var clientData = null;
var conn = null;
var hub = null;

var getmacAddress = function(callback){
    require('getmac').getMac(function(err,macAddress){
        if (err)  throw err;
        callback(macAddress);    
    });
};

var createSshKey = function(callback){
    keygen({
        location: sshKey,
        comment: "",
        password: "",
        read: true,
        destroy: false,
    }, function(err, out){
        if(err) return console.log('Something went wrong: '+err);
        // console.log('created new key');
        // console.log(out);
        callback(out);
    });
}

var getSshKey = function(callback){
    fs.exists(keyDir, function(exist){
        if(exist == false){
            fs.mkdirSync(keyDir);
        } 
        fs.exists(sshKey+'.pub', function(exist){

            if(exist != false){

                fs.readFile(sshKey+'.pub',{encoding:'utf-8'}, function(err, data){
                    if(err){
                        //TODO
                    }
                    fs.readFile(sshKey, {encoding: 'utf-8'}, function(err, priv){
                        var key = data;
                        var obj = {};
                            obj.key = priv;
                            obj.pubKey = data;

                            callback(obj);
                    });
                    
                });
            } else {
                //CREATE SSH KEYS named foo_rsa
                // console.log()
                createSshKey(callback);
            }
        });
    });

    // callback();
}

var readClient = function(callback){
    fs.readFile('client.json', 'utf8', function (err, data) {
      if (err) throw err;
        // callback(JSON.parse(data));
        clientData = JSON.parse(data);
        callback(clientData);
    });
}

var updateClientFile = function(callback){
    readClient(function(data){
        var d = data;
            getmacAddress(function(mac){
                d.uuid = mac;
                d.name = haiku();
                d.reset = false;

                fs.writeFile('client.json', JSON.stringify(d), function(err){
                    if(err) return err;

                    callback();
                }); 
            });   
    });
}
var discoverHub = function(callback){
    apps.get("apf-central-hub", function(address) {
        callback(address);
    });
}
var makeSshConnection = function(){
    
    discoverHub(function(address){        
        hub = address.host;

        readClient(function(ignoreMe){
            getSshKey(function(obj){
                var conn = new Connection();

                conn.on('ready', function() {
                  console.log('Connection :: ready');

                  conn._openChan('apf_data',function(err, stream) {
                    if (err) throw err;
                    stream.on('exit', function(code, signal) {
                      console.log('Stream :: exit :: code: ' + code + ', signal: ' + signal);
                    }).on('close', function() {
                      console.log('Stream :: close');
                      conn.end();
                    }).on('data', function(data) {
                      console.log('STDOUT: ' + data);
                    }).stderr.on('data', function(data) {
                      console.log('STDERR: ' + data);
                    });
                  });

                }).connect({
                  readyTimeout: 120000,
                  host: hub,
                  port: 2200,
                  username: clientData.uuid,
                  privateKey: obj.key
                });

            });
        });
    });
}

var init = function(){
    makeSshConnection();
}

var resetClient = function(){
    updateClientFile(function(){
        init();
    });
}

// resetClient();
init();



