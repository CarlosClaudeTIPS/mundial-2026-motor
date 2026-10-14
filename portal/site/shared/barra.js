/* Inserta la barra común al inicio de la página. Calcula la raíz del portal
   a partir de la ruta de este archivo (…/shared/barra.js). */
(function () {
  var cfg = window.PORTAL_CONFIG; if (!cfg) return;
  var s = document.currentScript || document.querySelector('script[src*="shared/barra.js"]');
  var root = s ? s.getAttribute("src").replace(/shared\/barra\.js.*$/, "") : "../";
  var path = location.pathname;
  var html = '<div class="pb-in"><a class="pb-marca" href="' + root + '" aria-label="' + cfg.marca.nombre + ', ir al inicio"><i></i><span>' + cfg.marca.nombre + '</span></a><nav>' +
    '<a href="' + root + '">Inicio</a>' +
    cfg.secciones.map(function (x) {
      var act = path.indexOf("/" + x.carpeta.replace(/\/$/, "") + "/") !== -1 ? ' class="activa"' : "";
      return '<a' + act + ' href="' + root + x.carpeta + '">' + x.nombre + '</a>';
    }).join("") + '</nav></div>';
  var bar = document.createElement("div"); bar.id = "portal-barra"; bar.innerHTML = html;
  function go() { document.body.insertBefore(bar, document.body.firstChild); }
  if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
})();
