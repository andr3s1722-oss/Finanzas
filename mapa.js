/* Mapa de viajes: dibuja el mundo con SVG propio (sin internet) y coloca un pin por cada ciudad. Incluye una base de ciudades. */
var MAP_W=720,MAP_H=360;
/* [nombre, país, bandera, lat, lon, otros nombres] */
var CIUDADES=[
 ['Bogotá','Colombia','🇨🇴',4.71,-74.07,'bogota'],['Medellín','Colombia','🇨🇴',6.25,-75.56,'medellin'],['Cali','Colombia','🇨🇴',3.45,-76.53],['Barranquilla','Colombia','🇨🇴',10.96,-74.8],
 ['Cartagena','Colombia','🇨🇴',10.39,-75.48],['Bucaramanga','Colombia','🇨🇴',7.12,-73.12,'bga'],['Santa Marta','Colombia','🇨🇴',11.24,-74.2],['Pereira','Colombia','🇨🇴',4.81,-75.69],
 ['Manizales','Colombia','🇨🇴',5.07,-75.52],['Armenia','Colombia','🇨🇴',4.53,-75.68],['Cúcuta','Colombia','🇨🇴',7.89,-72.51],['Ibagué','Colombia','🇨🇴',4.44,-75.23],
 ['Villavicencio','Colombia','🇨🇴',4.14,-73.63],['Pasto','Colombia','🇨🇴',1.21,-77.28],['Neiva','Colombia','🇨🇴',2.93,-75.28],['Montería','Colombia','🇨🇴',8.75,-75.88],
 ['Valledupar','Colombia','🇨🇴',10.46,-73.25],['Popayán','Colombia','🇨🇴',2.44,-76.61],['Tunja','Colombia','🇨🇴',5.54,-73.36],['San Andrés','Colombia','🇨🇴',12.58,-81.7],
 ['Leticia','Colombia','🇨🇴',-4.21,-69.94],['Guatapé','Colombia','🇨🇴',6.23,-75.16],['Jardín','Colombia','🇨🇴',5.6,-75.82],['Salento','Colombia','🇨🇴',4.64,-75.57],
 ['Villa de Leyva','Colombia','🇨🇴',5.63,-73.53],['Barichara','Colombia','🇨🇴',6.64,-73.22],['San Gil','Colombia','🇨🇴',6.56,-73.13],['Girardot','Colombia','🇨🇴',4.3,-74.8],
 ['Riohacha','Colombia','🇨🇴',11.54,-72.91],['Rionegro','Colombia','🇨🇴',6.15,-75.38],['Ipiales','Colombia','🇨🇴',0.83,-77.64],['Taganga','Colombia','🇨🇴',11.27,-74.19],
 ['Quito','Ecuador','🇪🇨',-0.18,-78.47],['Guayaquil','Ecuador','🇪🇨',-2.17,-79.92],['Cuenca','Ecuador','🇪🇨',-2.9,-79],['Baños','Ecuador','🇪🇨',-1.4,-78.42],['Montañita','Ecuador','🇪🇨',-1.83,-80.75],['Otavalo','Ecuador','🇪🇨',0.23,-78.26],
 ['Nueva York','Estados Unidos','🇺🇸',40.71,-74.01,'new york|nyc|manhattan|brooklyn'],['Albany','Estados Unidos','🇺🇸',42.65,-73.76],['Lake George','Estados Unidos','🇺🇸',43.43,-73.71],['Chicago','Estados Unidos','🇺🇸',41.88,-87.63],
 ['Fort Wayne','Estados Unidos','🇺🇸',41.08,-85.14],['Miami','Estados Unidos','🇺🇸',25.76,-80.19],['Orlando','Estados Unidos','🇺🇸',28.54,-81.38],['Los Ángeles','Estados Unidos','🇺🇸',34.05,-118.24,'los angeles|la'],
 ['San Francisco','Estados Unidos','🇺🇸',37.77,-122.42],['Las Vegas','Estados Unidos','🇺🇸',36.17,-115.14],['Boston','Estados Unidos','🇺🇸',42.36,-71.06],['Washington D. C.','Estados Unidos','🇺🇸',38.91,-77.04,'washington|dc'],
 ['Filadelfia','Estados Unidos','🇺🇸',39.95,-75.17,'philadelphia'],['Atlanta','Estados Unidos','🇺🇸',33.75,-84.39],['Houston','Estados Unidos','🇺🇸',29.76,-95.37],['Dallas','Estados Unidos','🇺🇸',32.78,-96.8],
 ['Austin','Estados Unidos','🇺🇸',30.27,-97.74],['Seattle','Estados Unidos','🇺🇸',47.61,-122.33],['Denver','Estados Unidos','🇺🇸',39.74,-104.99],['Phoenix','Estados Unidos','🇺🇸',33.45,-112.07],
 ['San Diego','Estados Unidos','🇺🇸',32.72,-117.16],['Nueva Orleans','Estados Unidos','🇺🇸',29.95,-90.07,'new orleans'],['Nashville','Estados Unidos','🇺🇸',36.16,-86.78],['Detroit','Estados Unidos','🇺🇸',42.33,-83.05],
 ['Cleveland','Estados Unidos','🇺🇸',41.5,-81.69],['Pittsburgh','Estados Unidos','🇺🇸',40.44,-80],['Buffalo','Estados Unidos','🇺🇸',42.89,-78.88],['Cataratas del Niágara','Estados Unidos','🇺🇸',43.09,-79.06,'niagara falls|niagara'],
 ['Saratoga Springs','Estados Unidos','🇺🇸',43.08,-73.78],['Siracusa','Estados Unidos','🇺🇸',43.05,-76.15,'syracuse'],['Rochester','Estados Unidos','🇺🇸',43.16,-77.61],['Burlington','Estados Unidos','🇺🇸',44.48,-73.21],
 ['Portland','Estados Unidos','🇺🇸',45.52,-122.68],['Honolulu','Estados Unidos','🇺🇸',21.31,-157.86,'hawaii|hawai'],['Tampa','Estados Unidos','🇺🇸',27.95,-82.46],['Fort Lauderdale','Estados Unidos','🇺🇸',26.12,-80.14],
 ['Cayo Hueso','Estados Unidos','🇺🇸',24.56,-81.78,'key west'],['Charlotte','Estados Unidos','🇺🇸',35.23,-80.84],['Mineápolis','Estados Unidos','🇺🇸',44.98,-93.27,'minneapolis'],['San Luis','Estados Unidos','🇺🇸',38.63,-90.2,'st louis|saint louis'],
 ['Indianápolis','Estados Unidos','🇺🇸',39.77,-86.16,'indianapolis'],['Baltimore','Estados Unidos','🇺🇸',39.29,-76.61],['Newark','Estados Unidos','🇺🇸',40.74,-74.17],
 ['Ciudad de México','México','🇲🇽',19.43,-99.13,'cdmx|mexico df|mexico'],['Cancún','México','🇲🇽',21.16,-86.85,'cancun'],['Guadalajara','México','🇲🇽',20.67,-103.35],['Monterrey','México','🇲🇽',25.69,-100.32],
 ['Ciudad de Panamá','Panamá','🇵🇦',8.98,-79.52,'panama'],['San José','Costa Rica','🇨🇷',9.93,-84.08,'san jose costa rica'],['Lima','Perú','🇵🇪',-12.05,-77.04],['Cusco','Perú','🇵🇪',-13.53,-71.97,'cuzco'],
 ['Santiago','Chile','🇨🇱',-33.45,-70.67],['Buenos Aires','Argentina','🇦🇷',-34.6,-58.38],['Montevideo','Uruguay','🇺🇾',-34.9,-56.16],['São Paulo','Brasil','🇧🇷',-23.55,-46.63,'sao paulo'],
 ['Río de Janeiro','Brasil','🇧🇷',-22.91,-43.17,'rio de janeiro|rio'],['Caracas','Venezuela','🇻🇪',10.48,-66.9],['La Habana','Cuba','🇨🇺',23.11,-82.37,'habana'],['Punta Cana','República Dominicana','🇩🇴',18.58,-68.4],
 ['Santo Domingo','República Dominicana','🇩🇴',18.49,-69.93],['San Juan','Puerto Rico','🇵🇷',18.47,-66.11],['Kingston','Jamaica','🇯🇲',17.97,-76.79],['Aruba','Aruba','🇦🇼',12.52,-70.03,'oranjestad'],
 ['La Paz','Bolivia','🇧🇴',-16.5,-68.15],['Asunción','Paraguay','🇵🇾',-25.26,-57.58,'asuncion'],
 ['Madrid','España','🇪🇸',40.42,-3.7],['Barcelona','España','🇪🇸',41.39,2.17],['Londres','Reino Unido','🇬🇧',51.51,-0.13,'london'],['París','Francia','🇫🇷',48.86,2.35,'paris'],
 ['Roma','Italia','🇮🇹',41.9,12.5,'rome'],['Ámsterdam','Países Bajos','🇳🇱',52.37,4.9,'amsterdam'],['Lisboa','Portugal','🇵🇹',38.72,-9.14,'lisbon'],['Berlín','Alemania','🇩🇪',52.52,13.4,'berlin'],
 ['Estambul','Turquía','🇹🇷',41.01,28.98,'istanbul'],['Dubái','Emiratos Árabes','🇦🇪',25.2,55.27,'dubai'],['Tokio','Japón','🇯🇵',35.68,139.69,'tokyo'],['Toronto','Canadá','🇨🇦',43.65,-79.38],
 ['Montreal','Canadá','🇨🇦',45.5,-73.57],['Vancouver','Canadá','🇨🇦',49.28,-123.12],['Sídney','Australia','🇦🇺',-33.87,151.21,'sydney'],['Bangkok','Tailandia','🇹🇭',13.76,100.5],
 ['El Cairo','Egipto','🇪🇬',30.04,31.24,'cairo'],['Ciudad del Cabo','Sudáfrica','🇿🇦',-33.92,18.42,'cape town'],['Atenas','Grecia','🇬🇷',37.98,23.73,'athens'],['Praga','Chequia','🇨🇿',50.08,14.44,'prague'],
 ['Viena','Austria','🇦🇹',48.21,16.37,'vienna'],['Zúrich','Suiza','🇨🇭',47.38,8.54,'zurich'],['Dublín','Irlanda','🇮🇪',53.35,-6.26,'dublin'],['Reikiavik','Islandia','🇮🇸',64.15,-21.94,'reykjavik'],
 ['Nueva Delhi','India','🇮🇳',28.61,77.21,'delhi'],['Seúl','Corea del Sur','🇰🇷',37.57,126.98,'seoul'],['Singapur','Singapur','🇸🇬',1.35,103.82,'singapore']
];
function mapNorm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();}
/* Busca una ciudad por nombre (sin tildes ni mayúsculas); acepta alias y búsquedas parciales. */
function ciudadBuscar(texto){
 var q=mapNorm(texto);if(q.length<2)return null;
 var best=null,score=0;
 CIUDADES.forEach(function(c){
  var names=[mapNorm(c[0])].concat(String(c[5]||'').split('|').filter(Boolean).map(mapNorm)),s=0;
  names.forEach(function(n){if(n===q)s=Math.max(s,100);else if(n.indexOf(q)===0&&q.length>=3)s=Math.max(s,60+q.length);else if(q.length>=4&&n.indexOf(q)>=0)s=Math.max(s,30+q.length);else if(n.length>=4&&q.indexOf(n)>=0)s=Math.max(s,20+n.length);});
  if(s>score){score=s;best=c;}
 });
 return best?{city:best[0],country:best[1],flag:best[2],lat:best[3],lon:best[4]}:null;
}
function banderaDe(code){code=String(code||'').toUpperCase();return /^[A-Z]{2}$/.test(code)?String.fromCodePoint(127397+code.charCodeAt(0),127397+code.charCodeAt(1)):'';}
/* Si la ciudad no está en la lista, la busca en línea (Open-Meteo, gratis y sin llave). */
async function ciudadGeocodificar(texto){
 var q=String(texto||'').trim();if(q.length<2)return null;
 try{
  var r=await cloudRequest('https://geocoding-api.open-meteo.com/v1/search?count=1&language=es&format=json&name='+encodeURIComponent(q),{});
  var x=r.ok&&r.data&&r.data.results&&r.data.results[0];
  if(!x||typeof x.latitude!=='number')return null;
  return {city:x.name||q,country:x.country||'',flag:banderaDe(x.country_code),lat:x.latitude,lon:x.longitude};
 }catch(e){return null;}
}
function mapXY(lat,lon){return [(Number(lon)+180)/360*MAP_W,(90-Number(lat))/180*MAP_H];}
/* Encuadra los puntos: nunca demasiado cerca (una sola ciudad se ve en su región) ni fuera del mapa. */
function mapView(pts,aspect,minW){
 aspect=aspect||1.9;minW=minW||60;
 if(!pts.length){var ww=Math.min(MAP_W,MAP_H*aspect);return [(MAP_W-ww)/2,0,ww,ww/aspect];}
 var xs=pts.map(function(p){return p[0];}),ys=pts.map(function(p){return p[1];});
 var x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs),y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys);
 var cx=(x0+x1)/2,cy=(y0+y1)/2,w=Math.max((x1-x0)*1.5,(y1-y0)*1.5*aspect,minW),h=w/aspect;
 if(h>MAP_H){h=MAP_H;w=h*aspect;}
 if(w>MAP_W){w=MAP_W;h=w/aspect;}
 var x=Math.min(Math.max(cx-w/2,0),MAP_W-w),y=Math.min(Math.max(cy-h/2,0),MAP_H-h);
 return [x,y,w,h];
}
function mapaSvg(viajes,o){
 o=o||{};
 var pts=viajes.filter(function(v){return typeof v.lat==='number';}).map(function(v){return {v:v,p:mapXY(v.lat,v.lon)};});
 var vb=mapView(pts.map(function(q){return q.p;}),o.aspect,o.minW),w=vb[2],u=w/100;   // u = unidad relativa al zoom
 var s='<svg class="map '+(o.cls||'')+'" viewBox="'+vb.map(function(n){return n.toFixed(1);}).join(' ')+'" preserveAspectRatio="xMidYMid slice" role="img" aria-label="'+esc(o.label||'Mapa de viajes')+'">'
  +'<rect class="map-sea" x="0" y="0" width="'+MAP_W+'" height="'+MAP_H+'"/>';
 for(var lon=-150;lon<=150;lon+=30){var gx=(lon+180)/360*MAP_W;s+='<line class="map-grid" x1="'+gx+'" y1="0" x2="'+gx+'" y2="'+MAP_H+'"/>';}
 for(var lat=-60;lat<=60;lat+=30){var gy=(90-lat)/180*MAP_H;s+='<line class="map-grid" x1="0" y1="'+gy+'" x2="'+MAP_W+'" y2="'+gy+'"/>';}
 s+='<path class="map-land" d="'+(typeof WORLD_PATH==='string'?WORLD_PATH:'')+'"/>';
 var orden=pts.slice().sort(function(a,b){return String(a.v.start||'').localeCompare(String(b.v.start||''));});
 if(o.ruta!==false&&orden.length>1){
  for(var i=0;i<orden.length-1;i++){
   var a=orden[i].p,b=orden[i+1].p;if(Math.abs(a[0]-b[0])<0.5&&Math.abs(a[1]-b[1])<0.5)continue;
   var mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2-Math.hypot(b[0]-a[0],b[1]-a[1])*0.22;
   s+='<path class="map-route" style="stroke-width:'+(u*0.45).toFixed(2)+';stroke-dasharray:'+(u*1.6).toFixed(2)+' '+(u*1.4).toFixed(2)+'" d="M'+a[0].toFixed(1)+' '+a[1].toFixed(1)+' Q'+mx.toFixed(1)+' '+my.toFixed(1)+' '+b[0].toFixed(1)+' '+b[1].toFixed(1)+'"/>';
  }
 }
 pts.forEach(function(q,i){
  var x=q.p[0].toFixed(1),y=q.p[1].toFixed(1),r=(u*(o.pin||1.5)).toFixed(2),act=o.activo===q.v.id;
  s+='<g class="map-pin'+(act?' on':'')+'"'+(o.click?' onclick="'+o.click+'(\''+q.v.id+'\')" tabindex="0" role="button" aria-label="'+esc(q.v.city||q.v.name)+'"':'')+'>'
   +'<circle class="map-pulse" cx="'+x+'" cy="'+y+'" r="'+r+'" style="animation-delay:'+(i*0.35).toFixed(2)+'s"/>'
   +'<circle class="map-dot" cx="'+x+'" cy="'+y+'" r="'+(r*0.62).toFixed(2)+'"/>'
   +(o.etiquetas?'<text class="map-label" x="'+(q.p[0]+u*2.2).toFixed(1)+'" y="'+(q.p[1]+u*0.9).toFixed(1)+'" style="font-size:'+(u*2.5).toFixed(2)+'px">'+esc(q.v.city||q.v.name)+'</text>':'')
   +'</g>';
 });
 return s+'</svg>';
}
