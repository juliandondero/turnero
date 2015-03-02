/**
 * Main application routes
 */

'use strict';

var errors = require('./components/errors');
var express=require('express');
var loggers=require('./loggers')();
module.exports = function (app, turnos,pautas) {

    // Insert routes below
    app.use('/api/things', require('./api/thing'));

    app.route('/getConfig')
        .get(function (req, res) {
            res.json(turnos.getConfig());
        });

    app.route('/cola/:idcola/actual')
        .get(function (req, res) {
            var cola_id = req.params.idcola;
            res.json(turnos.current(cola_id));
        });

    app.route('/cola/:idcola/siguiente')
        .get(function (req, res) {
            var from = req.query.from;
            var cola_id = req.params.idcola;
            res.json(turnos.next(from, cola_id));
        });

    app.route('/cola/:idcola/anterior')
        .get(function (req, res) {
            var from = req.query.from;
            var cola_id = req.params.idcola;
            res.json(turnos.previous(from, cola_id));
        });


    app.route('/get_config')
        .get(function (req, res) {
            res.sendfile(app.get('configPath') + '/config.json');
        })
        .post(function (req, res) {
            var fs = require('fs');
            var outputFilename = app.get('configPath') + '/config.json';
            fs.writeFile(outputFilename, JSON.stringify(req.body, null, 4), function (err) {
                if (err) {
                    loggers.turnero_logger.error(err);
                } else {
                    loggers.turnero_logger.info("JSON saved to " + outputFilename);
                }
            });
            res.json({"error": 0, "message": "la configuración fue guardada con éxito!"})
        });


    app.route('/api/listaPautas')
        .get(function (req, res) {

            var tipoPuesto=req.query.tipo_puesto;
            var puestoVenta=req.query.puesto_venta;
            var nombreNodo=req.query.nombre_nodo;

            if (tipoPuesto==undefined || puestoVenta==undefined ||nombreNodo==undefined){
                return res.send(500, "Debe completar tipo_puesto, puesto_venta, nombre_nodo.")
            } else {
                var callbackListaReproduccion=function(listaRep){
                    res=res.json(listaRep);
                };

                pautas.getListaReproduccion(nombreNodo,puestoVenta,tipoPuesto,callbackListaReproduccion);
            }

        });

    app.route('/api/log_pauta_reproducida')
        .post(function (req, res) {


            var pautaReproducida=req.body.pauta_reproducida;
            var puestoVenta=req.query.puesto_venta;
            var nombreNodo=req.query.nombre_nodo;

            if ( puestoVenta==undefined ||nombreNodo==undefined||pautaReproducida==undefined){
                return res.send(500, "Debe completar pauta_reproducida, puesto_venta, nombre_nodo.")
            } else {
                var callback_success=function(){
                    loggers.sponsor_logger.info("Pauta logueada");
                    res.json("Ok! pauta reproducida");
                };
                var callback_error=function(error){
                    loggers.sponsor_logger.error("Error al loguear la pauta");
                    res.send(500, "Error: "+error);
                };
                pautas.loguearPautaReproducida(pautaReproducida,puestoVenta, nombreNodo,callback_success,callback_error);
            }

        });

    // All undefined asset or api routes should return a 404
    app.route('/:url(api|auth|components|app|bower_components|assets)/*')
        .get(errors[404]);

    // All other routes should redirect to the index.html

    app.use('/pantalla-app/',express.static(__dirname+'/pantalla-app' ));
    app.use('/videos/',express.static(__dirname+'/videos' ));

    app.route('/*')
        .get(function (req, res) {
            res.sendfile(app.get('appPath') + '/index.html');
        });

};
