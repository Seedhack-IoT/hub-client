var keygen = require('ssh-keygen');
var fs = require('fs');
var Connection = require('ssh2');
var keyDir = __dirname+'/keys';
var sshKey = keyDir + '/foo_rsa';
    // sshKey = '/Users/mani/.ssh/id_rsa'
var comment = 'device_name';
var password = false;
var haiku = require('./haiku.js');
var polo = require("polo");
var apps = polo();
var Channel = require('./node_modules/ssh2/lib/Channel.js');
var clientData = null;
var conn = null;
var hub = null;
var sys = require('sys');
var exec = require('child_process').exec;
var child = null;
// var exec = require('child_process').exec;
// var sensor = require('./sensor.js');
var PythonShell = require('python-shell');

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
    fs.readFile(__dirname+'/client.json', 'utf8', function (err, data) {
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

                fs.writeFile(__dirname+'/client.json', JSON.stringify(d), function(err){
                    if(err) return err;

                    callback();
                }); 
            });   
    });
}
var discoverHub = function(callback){
    var address = {host: '10.100.93.145', port:2200};
    return callback(address);

    apps.get("apf-central-hub", function(address) {
        callback(address);
    });
}

var childStdout = function(data){
    //PARSE OUTPUT HERE AND DO SHIT WITH IT
    console.log("STDOUT: "+ data);
    // childStdin("HELLO WORLD");
}

var childStdin = function(data){
    if(child !== null){
        child.stdin.write(data+'\n');
    }
}

var makeSshConnection = function(){
    console.log("Making SSH connection...");
    discoverHub(function(address){        
        // hub = address.host;
        console.log("Found our hub...");
        readClient(function(ignoreMe){
            console.log("Getting ssh key...");
            getSshKey(function(obj){

                var ret = {
                        key: {
                                priv: sshKey, 
                                pub: sshKey+'.pub'
                        },
                        client: clientData,
                        hub: address,
                        path: "config"
                };

                // console.log(ret);

                fs.writeFile('config.json', JSON.stringify(ret), function(err){
                    if (err) return err;

                    // So, the ssh client for some reason wont receive anything 
                    // from the ssh server
                    // so this is a hacky way to have a ssh client 
                    // without changing all js code
                    // client written in go and compiled

                    console.log("Starting Go process");

                    child = exec(__dirname+'/sshClient_arm ./config.json');
                    child.stdin.setEncoding('utf8');
                    // childStdin("HELLO WORLD");
                    childStdin(clientData);
                    child.stdout.on('data', childStdout);

                    child.stderr.on('data', function(data) {
                        console.log('stderr: ' + data);
                        // childStdin("HELLO WORLD");
                    });

                    child.on('close', function(code) {
                        console.log('closing code: ' + code);
                    });
                    console.log("Going to start reading sensor");
                    // sensor.read('motion_sensor',function(data){

                    //     var d = data;
                    //         d.uuid = clientData.uuid;
                    //         d.path = "read_data";   
                    //         console.log("motion data: "+d);

                    //         childStdin(d);
                    // });

                    PythonShell.run('motion_sensor.py', {scriptPath:'../sensors/'}, function (err, data) {
                              if (err) return console.log(err);
                              // console.log("Motion: ",parseInt(data[0]));
                              //if (data){
                                var d = {};
                            d.uuid = clientData.uuid;
                            d.path = "read_data"; 
                            d.type = "motion_sensor";
                            d.value = data;  
                            d.error = false;
                            d.message = "";
                            
                            console.log("motion data: "+d);
                            
                            childStdin(d);
                                    //callback({type:param, value:data, error: false, message:null});
                              //}
                        });

                });

                    
                
                

                // var conn = new Connection();

                // console.log("Trying to connect...");

                // conn.on('ready', function() {
                //   console.log('Connection :: ready');




                //   conn._openChan('apf_data',function(err, chan) { //apf_data
                //     if (err) throw err;

                //     console.log("Got a channel...");
                //     console.log("Creating new stream...");

                //     var stream = new Channel.ChannelStream(chan);

                //     stream.on('exit', function(code, signal) {
                //       console.log('Stream :: exit :: code: ' + code + ', signal: ' + signal);
                //     });
                //     // stream.setEncoding('utf8');
                //     stream.on('close', function() {
                //       console.log('Stream :: close');
                //       conn.end();
                //     });

                //     stream.on('data', function(data) {
                //       console.log('STDOUT: ' + data);
                //     });

                //     stream.stderr.on('data', function(data) {
                //       console.log('STDERR: ' + data);
                //     });

                //     stream.on('complete' ,function(data){
                //             console.log(data);
                //     });
                //     // console.log(stream._read(10));
                //     // console.log(chan.incoming);
                //     // process.stdin.pipe(Channel.pipe

                //     stream.write(JSON.stringify(clientData)+'\n');
                //   });
// conn.exec('yes', function(err, stream) {
//     if (err) throw err;
//     stream.on('exit', function(code, signal) {
//       console.log('Stream :: exit :: code: ' + code + ', signal: ' + signal);
//     }).on('close', function() {
//       console.log('Stream :: close');
//       conn.end();
//     }).on('data', function(data) {
//       console.log('STDOUT: ' + data);
//     }).stderr.on('data', function(data) {
//       console.log('STDERR: ' + data);
//     });
//   });
// conn.shell(function(err, stream) {
//     if (err) throw err;
//     stream.on('close', function() {
//       console.log('Stream :: close');
//       conn.end();
//     }).on('data', function(data) {
//       console.log('STDOUT: ' + data);
//     }).stderr.on('data', function(data) {
//       console.log('STDERR: ' + data);
//     });
//     stream.write('Hello world!\n');
//     stream.end('ls -l\nexit\n');
//   });
  // conn.sftp(function(err, sftp) {
  //   if (err) throw err;
  //   sftp.readdir('/', function(err, list) {
  //     if (err) throw err;
  //     console.dir(list);
  //     conn.end();
  //   });
  // });

                // }).connect({
                //   readyTimeout: 120000,
                //   host: address.host,
                //   port: address.port,
                //   username: clientData.uuid,
                //   privateKey: obj.key,
                // });

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

resetClient();
// init();



