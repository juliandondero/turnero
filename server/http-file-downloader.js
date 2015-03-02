var fs = require('fs');
var url = require('url');
var http = require('http');
var async = require('async');
var S = require('string');
var _ = require('underscore');
var loggers=require('./loggers')();

var download_file_httpget= function(file_descriptor,callback) {      //files_descriptor: {url,name,dest}
    if (!S(file_descriptor.dest).endsWith("/")){
        file_descriptor.dest=file_descriptor.dest+"/";
    }

    var options = {
        host: url.parse(file_descriptor.url).hostname,
        port: (url.parse(file_descriptor.url).port==null)?80:url.parse(file_descriptor.url).port,
        path: url.parse(file_descriptor.url).pathname
    };

    //obtenemos headers del archivo a ver si pisamos
    var options_head = _.clone(options);
    options_head.method = 'HEAD';

    http.get(options_head,
        function(res) {
            var remoteFileSize=res.headers['content-length'];

            if ( (!fs.existsSync(file_descriptor.dest + file_descriptor.name)) || (fs.statSync(file_descriptor.dest + file_descriptor.name)["size"]!=undefined && fs.statSync(file_descriptor.dest + file_descriptor.name)["size"] < remoteFileSize ) ){
                loggers.sponsor_logger.info("obteniendo: "+file_descriptor.name);
                var file = fs.createWriteStream(file_descriptor.dest + file_descriptor.name);

                http.get(options, function(res) {
                    res.on('data', function(data) {

                        file.write(data);
                    }).on('end', function() {
                        file.end();
                        loggers.sponsor_logger.info(file_descriptor.name + ' descargado en ' + file_descriptor.dest);
                        callback();
                    }).on('error', function(error) {
                        //si hay un error en alguna de las descargas sigo con el resto
                        loggers.sponsor_logger.error("Error al descargar: "+file_descriptor.url+", "+error);
                        callback();
                    });
                });
            }
            else {
                //ya existe el archivo
                loggers.sponsor_logger.info(file_descriptor.dest + file_descriptor.name+" ya existe.");
                callback();
            }

        },function(err){
            loggers.sponsor_logger.error(err);
        }
    );


};

// Function to download file using HTTP.get
var FileDownloaderModule = {

    download_files:function(files_descriptor,callback_success,callback_error){              //files_descriptor: {url,name,dest}

        //eachSeries para no matar el servidor de videos
        async.eachSeries(files_descriptor, download_file_httpget, function(err){
            // if any of the file processing produced an error, err would equal that error
            if( err ) {
                if (callback_error!=undefined)
                    callback_error(err);
            } else {
                if (callback_success!=undefined)
                    callback_success();

            }
        });
    }
}


module.exports=FileDownloaderModule;