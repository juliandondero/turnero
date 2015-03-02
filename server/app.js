/**
 * Main application file
 */

'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var loggers=require('./loggers')();


var express = require('express');
var config = require('./config/environment');

// Setup server
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var turnos = require('./turnos')(__dirname+'/config/config.json', io);
require('./config/express')(app);

if (config.sponsor!=undefined && config.sponsor.url_conection!=undefined){
    var moduloPautas=require('./modulo-pautas')(config.sponsor.url_conection);

    require('./routes')(app, turnos,moduloPautas);

    //chequeamos la predescarga de pautas cada 1 hora (si los archivos ya existen no los descarga)

    var preDescargarPautas=function(){
        moduloPautas.descargar_pautas(
            config.sponsor.puestos_habilitados,
            function (result) {

                loggers.sponsor_logger.info("Pautas descargadas!");
                if (result != undefined)
                    loggers.sponsor_logger.info(result);
            },
            function (error) {
                loggers.sponsor_logger.error(error);
            });
    };

    preDescargarPautas();
    var minutosPreDescarga=(config.sponsor.intervalo_descarga==undefined)?60:config.sponsor.intervalo_descarga;
    setInterval(preDescargarPautas,1000*60*minutosPreDescarga);


} else {
    loggers.sponsor_logger.error("No se definio string de coneccion para las pautas publicitarias: sponsor.url_conection");
}


// Start server
server.listen(config.port, config.ip, function () {
    loggers.turnero_logger.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
});

// Expose app
exports = module.exports = app;

if (config.turnero.xml_inputs!=undefined && config.turnero.xml_inputs.urlXmlEndpointIn !=undefined && config.turnero.xml_inputs.urlXmlEndpointOut !=undefined){
    loggers.turnero_logger.log("Utilizando xml endpoints: \n");
    loggers.turnero_logger.log(" - Entrada: \n"+config.turnero.xml_inputs.urlXmlEndpointIn);
    loggers.turnero_logger.log(" - Salida: \n"+config.turnero.xml_inputs.urlXmlEndpointOut);
    var fsWatcher=require('./fs-watcher')(config.turnero.xml_inputs.urlXmlEndpointIn,config.turnero.xml_inputs.urlXmlEndpointOut,turnos);
} else {
    loggers.turnero_logger.info("No se configuraron las rutas para el manejo por xml en el archivo config.json.");
}




