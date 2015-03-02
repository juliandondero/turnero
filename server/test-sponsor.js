//TODO volar
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var SponsorUtils=require('./sponsor-utils');
var config = require('./config/environment');
var loggers=require('./loggers')();
var conString = "postgres://postgres:password@192.168.2.130/ftweb";
var nombreNodo='YUNOW';
var tipoPuesto=1;
var puestoVenta=862830;


/* Metodo que se ejecuta una vez armada la lista de reproduccion */
var callbackListaReproduccion=function(listaReproduccion){

    console.log("Lista a reproducir: " + SponsorUtils.mostrarLista(listaReproduccion));
};


var pautas=require('./modulo-pautas')(config.sponsor.url_conection);


pautas.descargar_pautas(
    config.sponsor.puestos_habilitados,
    function(result){

        console.log("Pautas descargadas!");
        if (result!=undefined)
            console.log(result);
    },
    function(error){
        console.log(error);
    });
//pautas.getListaReproduccion(nombreNodo,puestoVenta,tipoPuesto,callbackListaReproduccion);

/*var FileDownloader=require('./http-file-downloader.js');

files=[
    {
        url:"http://zmaestros.zetti.com.ar:80/sponsor/lucerna.flv",
        name:"lucerna-v1.flv",
        dest:"./videos/"
    },
    {
        url:"http://zmaestros.zetti.com.ar:80/sponsor/nutricia-vital-aire.flv",
        name:"nutricia-vital-aire-v1.flv",
        dest:"./videos"
    },
    {
        url:"http://zmaestros.zetti.com.ar:80/sponsor/aerotina.flv",
        name:"aerotina-v1.flv",
        dest:"./videos"
    }
];

FileDownloader.download_files(files);*/