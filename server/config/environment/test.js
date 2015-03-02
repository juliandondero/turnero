'use strict';

// Test specific configuration
// ===========================
module.exports = {
    sponsor:{
        url_conection:"postgres://postgres:password@192.168.2.130/ftweb",
        puestos_habilitados:[
            {
                nombreNodo:'YUNOW',
                tipoNodo: 1,
                puestoVenta:862830
            }
        ],
        dir_videos:"./server/videos/",
        dir_logs:"./server/logs/",
        url_videos: "http://zturnos/videos/",
        intervalo_descarga: 120 //cada 2 hs
    },
    turnero:{
        xml_inputs:{
            urlXmlEndpointIn:'/home/juli/Zetti/zTurnosServerWorkspace/xml-endpoint/input/',
            urlXmlEndpointOut:'/home/juli/Zetti/zTurnosServerWorkspace/xml-endpoint/output/'
        }
    },
    ip:       process.env.OPENSHIFT_NODEJS_IP ||
        process.env.IP ||
        undefined,


    port:     process.env.OPENSHIFT_NODEJS_PORT ||
        process.env.PORT ||
        3000
};