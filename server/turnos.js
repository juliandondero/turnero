/**
 * Module dependencies.
 */

var fs = require('fs');
var loggers=require('./loggers')();

/**
 * Module variables.
 */

//variables globales donde tengo las colas y namespaces
var colas = {}; //guardo las colas
var pantallas = {}; //guardo los sockets de las pantallas
var colas_pantallas = {}; //relacion por cada cola que cambia a que pantallas aviso
var pantallas_colas = {}; //relacion por cada pantalla tengo las colas que le corresponden
var GENERADOR_NAMESPACE = '/generar';
var PANTALLA_NAMESPACE = '/pantalla';
var COLA_NAMESPACE = '/cola';

/**
 * Expose application.
 */

var _ = require('underscore');
module.exports = function (file_path, io) {

	init(file_path, io);

	return {
		getConfig: function () {
			var rta = {};
			var queues = Array();
			for (var cola in colas) {
				var ret_config = {};
				ret_config.cola_id = cola;
				ret_config.nombre = colas[cola].nombre;
				ret_config.prefijo = colas[cola].prefijo;
				ret_config.color = colas[cola].color;
                ret_config.nro_inicial= colas[cola].nro_inicial;
                ret_config.nro_final= colas[cola].nro_final;
				queues.push(ret_config);
			}
			rta.colas = queues;
			rta.generador = GENERADOR_NAMESPACE;
			rta.pantallas = PANTALLA_NAMESPACE;
			return rta;
		},
		current: function (cola_id) {
			return {
				current: expose_cola(colas[cola_id]).current
			};
		},
		next: function (from, cola_id) {
			colas[cola_id].from = from;
            var actual = avanzarCola(cola_id);
			var ret = {
				current: actual
			};
			//TODO avisarle a las pantallas
			actualizarPantallas(cola_id, from);
			return ret;
		},

		previous: function (from, cola_id) {
			colas[cola_id].from = from;
            var actual = retrocederCola(cola_id);
			var ret = {
				current: actual
			};
			//TODO avisarle a las pantallas
			actualizarPantallas(cola_id, from);
			return ret;
		},
        reset: function (from, cola_id) {
            colas[cola_id].from = from;
            var actual = resetearCola(cola_id);
            var ret = {
                current: actual
            };
            //TODO avisarle a las pantallas
            actualizarPantallas(cola_id, from);
            return ret;
        },
        set: function (from, cola_id,numero) {
            colas[cola_id].from = from;
            var actual = setearCola(cola_id,numero);
            var ret = {
                current: actual
            };
            //TODO avisarle a las pantallas
            actualizarPantallas(cola_id, from);
            return ret;
        },
        set_turno_solapado: function (from, cola_id,numero) {
            colas[cola_id].from = from;
            var actual = setearTurnoSolapado(cola_id,numero);
            var ret = {
                current: actual
            };
            actualizarPantallas(cola_id, from);
            return ret;
        }
	};

	function init(file_path, io) {
		//Genero los sockets comunes
		var generador = io.of(GENERADOR_NAMESPACE);
		generador.on('connection', function (socket) {
			socket.on('generate', function (msg) {
				colas[msg.cola_id].gen++;
				socket.emit('generate', colas[msg.cola_id].gen);
			})
		});

//Genero el socket que devuelve la configuracion inicial
		io.on('connection', function (socket) {
            loggers.turnero_logger.info("Pantalla conectada.");
			socket.on('get_config', function (msg) {
				var rta = {};
				var queues = Array();
				for (var cola in colas) {
					var ret_config = {};
					ret_config.cola_id = cola;
					ret_config.nombre = colas[cola].nombre;
					ret_config.prefijo = colas[cola].prefijo;
					ret_config.color = colas[cola].color;
					queues.push(ret_config);
				}
				rta.colas = queues;
				rta.generador_nsp = GENERADOR_NAMESPACE;
				rta.pantallas_nsp = PANTALLA_NAMESPACE;
				rta.colas_nsp = COLA_NAMESPACE;
				socket.emit('get_config', rta);
			})
		});
		//Leo la configuracion inicial del archivo de configuracion
		fs.readFile(file_path, 'utf8', function (err, data) {
			if (err) {
                loggers.turnero_logger.error('Error al leer archivo de configuración: ' + err);
				return;
			}

			var config = JSON.parse(data);

			//Me armo un dic con la relacion de las colas y las pantallas segun los grupos de estas ultimas
			for (var pantalla_id in config.pantallas) {
				var grupos_pantalla = config.pantallas[pantalla_id].grupos;
				for (var grupo in grupos_pantalla) {
					var elem = grupos_pantalla[grupo];
					var colas_del_grupo = config.grupos[elem].colas;
					var colas_de_la_pantalla = [];
					for (idx in colas_del_grupo) {
						var cola_actual = colas_del_grupo[idx];
						colas_de_la_pantalla.push(cola_actual);
					}
					pantallas_colas[pantalla_id] = colas_de_la_pantalla;
				}
			}
			for (var idx_cola in config.colas) {
				cola_actual = config.colas[idx_cola];
				var pantallas_a_agregar = [];
				for (var pantalla in pantallas_colas) {
					var pantalla_actual = pantallas_colas[pantalla];
					if (pantalla_actual.indexOf(idx_cola) >= 0) {
						pantallas_a_agregar.push(pantalla);
					}
				}
				colas_pantallas[idx_cola] = pantallas_a_agregar;
			}

			//Inicializo las pantallas
			for (var pantalla_id in config.pantallas) {
				var pantalla_nsp = io.of(PANTALLA_NAMESPACE + pantalla_id);
				pantalla_nsp.pantalla_id = pantalla_id;
				pantalla_nsp.on('connection', function (socket) {
                    loggers.turnero_logger.info("Pantalla conectada.");
					socket.on('status', function (msg) {
                        loggers.turnero_logger.info("Pedido de estado.");
						var colas_a_enviar = pantallas_colas[socket.nsp.pantalla_id];
						var rta_colas = Array();
						colas_a_enviar.forEach(function (cola_id) {
							var cola_actual = colas[cola_id];
							cola_actual.cola_id = cola_id;
							//inicializo el from de las colas con sin asignar
							cola_actual.from = 'sin asignar';
							rta_colas.push(expose_cola(cola_actual));
						});
						socket.emit('status', rta_colas);
					})
				});
				pantallas[pantalla_id] = pantalla_nsp;
			}

			//Inicializo las colas
			for (var cola_id in config.colas) {
				var cola = config.colas[cola_id];
				//TODO aca meter la parte del estado anterior
				cola.current = cola.nro_inicial;
				cola.gen = 0;
				colas[cola_id] = cola;
				var cola_socket = io.of(COLA_NAMESPACE + cola_id);
				cola_socket.on('connection', function (socket) {
					socket.on('get_next', function (msg) { //msg:{cola_id, from}
//				var cola_solicitada = colas[msg.cola_id];
//				console.log('pido next');
//				colas[msg.cola_id].current++;
						socket.emit('get_next', avanzarCola(msg.cola_id));

						//se le avisa a las pantallas que corresponda de la atencion del turno
						actualizarPantallas(msg.cola_id, msg.from);
					})
				});

			}
		});
	}

    function avanzarCola(cola_id) {
        if (colas[cola_id].current == colas[cola_id].nro_final){
            colas[cola_id].current = colas[cola_id].nro_inicial;
        } else {
            colas[cola_id].current++;
        }
        colas[cola_id].turno_solapado=undefined;
        return colas[cola_id].current
    }

    function retrocederCola(cola_id) {
        if (colas[cola_id].current == colas[cola_id].nro_inicial){
            colas[cola_id].current = colas[cola_id].nro_final;
        } else {
            colas[cola_id].current--;
        }
        colas[cola_id].turno_solapado=undefined;
        return colas[cola_id].current
    }

    function resetearCola(cola_id) {

        if (colas[cola_id].nro_inicial!=undefined)
            colas[cola_id].current = colas[cola_id].nro_inicial;
        else
            colas[cola_id].current=0;

        colas[cola_id].turno_solapado=undefined;
        return colas[cola_id].current
    }

    function setearCola(cola_id,numero) {

        if (colas[cola_id].nro_inicial!=undefined  && numero < colas[cola_id].nro_inicial){
            colas[cola_id].current=colas[cola_id].nro_inicial;
        } else {
            if (colas[cola_id].nro_final!=undefined && numero > colas[cola_id].nro_final){
                colas[cola_id].current=colas[cola_id].nro_final;
            } else {
                //en rango
                colas[cola_id].current=numero;
            }
        }
        colas[cola_id].turno_solapado=undefined;
        return colas[cola_id].current
    }


    function setearTurnoSolapado(cola_id,numero) {

        //no importa si el turno esta fuera de rango, le hago caso
        colas[cola_id].turno_solapado=numero;

        return colas[cola_id].turno_solapado;
    }

    function actualizarPantallas(cola_id, from) {
	    if(from==undefined){from='';}
	    colas_pantallas[cola_id].forEach(function (pantalla) {
		    pantallas[pantalla].emit('refresh', expose_cola(colas[cola_id]));
	    });
    }

    function expose_cola(cola){
        var cola_exp= _.clone(cola);
        if (cola.turno_solapado!=undefined){
            cola_exp.current=cola.turno_solapado;
        }
        cola_exp.turno_solapado=undefined;
        return cola_exp;
    }
};




