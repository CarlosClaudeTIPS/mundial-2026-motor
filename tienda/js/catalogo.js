(function () {
  const T = window.Tienda;
  T.iniciar('catalogo', ({ catalogo }) => {
    const params = new URLSearchParams(location.search);
    const estado = {
      q: params.get('q') || '', cat: params.get('cat') || '', f: params.get('f') || '',
      min: '', max: '', nuevos: false, ofertas: false, disponibles: false, orden: 'relevancia'
    };
    if (estado.f === 'nuevos') estado.nuevos = true;
    if (estado.f === 'ofertas') estado.ofertas = true;

    const cats = catalogo.categorias.filter(c => c.visible !== false && T.visibles().some(p => p.categoria === c.id));
    T.$('#f-categorias').innerHTML = `<label><input type="radio" name="cat" value="" ${!estado.cat ? 'checked' : ''}> Todas</label>` +
      cats.map(c => `<label><input type="radio" name="cat" value="${T.esc(c.id)}" ${estado.cat === c.id ? 'checked' : ''}> ${T.esc(c.nombre)}</label>`).join('');
    T.$('#f-nuevos').checked = estado.nuevos; T.$('#f-ofertas').checked = estado.ofertas;
    const buscadores = T.$$('.buscador input'); buscadores.forEach(i => i.value = estado.q);

    const chips = () => {
      const def = [['', 'Todo'], ['destacados', 'Destacados'], ['populares', 'Populares'], ['nuevos', 'Novedades'], ['ofertas', 'Ofertas']];
      T.$('#chips').innerHTML = def.map(([k, t]) => `<a class="chip ${estado.f === k && !estado.cat ? 'activo' : ''}" href="catalogo.html${k ? '?f=' + k : ''}">${t}</a>`).join('') +
        cats.map(c => `<a class="chip ${estado.cat === c.id ? 'activo' : ''}" href="catalogo.html?cat=${encodeURIComponent(c.id)}">${T.esc(c.nombre)}</a>`).join('');
    };

    const aplicar = () => {
      let lista = T.visibles();
      if (estado.cat) lista = lista.filter(p => p.categoria === estado.cat);
      if (estado.f === 'destacados') lista = lista.filter(p => p.destacado);
      if (estado.f === 'populares') lista = lista.filter(p => p.popular);
      if (estado.nuevos) lista = lista.filter(p => p.nuevo);
      if (estado.ofertas) lista = lista.filter(p => p.oferta);
      if (estado.disponibles) lista = lista.filter(p => p.disponible);
      if (estado.min !== '' && !isNaN(estado.min)) lista = lista.filter(p => p.precio >= Number(estado.min));
      if (estado.max !== '' && !isNaN(estado.max)) lista = lista.filter(p => p.precio <= Number(estado.max));
      if (estado.q) lista = T.buscar(lista, estado.q);
      switch (estado.orden) {
        case 'precio-asc': lista = lista.slice().sort((a, b) => a.precio - b.precio); break;
        case 'precio-desc': lista = lista.slice().sort((a, b) => b.precio - a.precio); break;
        case 'nuevos': lista = lista.slice().sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || '')); break;
        case 'nombre': lista = lista.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')); break;
        default: if (!estado.q) lista = lista.slice().sort((a, b) => (b.disponible - a.disponible) || (b.destacado - a.destacado) || ((a.orden || 0) - (b.orden || 0)));
      }
      const cat = T.categoria(estado.cat);
      T.$('#titulo-catalogo').textContent = estado.q ? `Resultados para “${estado.q}”` : cat ? cat.nombre : ({ nuevos: 'Novedades', ofertas: 'Ofertas', destacados: 'Destacados', populares: 'Populares' })[estado.f] || 'Catálogo';
      T.$('#sub-catalogo').textContent = cat ? (cat.descripcion || '') : '';
      T.$('#conteo').textContent = `${lista.length} producto${lista.length === 1 ? '' : 's'}`;
      T.renderGrid('#grid', lista, (estado.q ? 'No encontramos productos con esa búsqueda. Prueba con otra palabra o <a href="catalogo.html">mira todo el catálogo</a>.' : 'No hay productos con estos filtros.') + '<div style="margin-top:1.2rem;text-align:left">' + T.encuesta('¿Buscabas algo que no tenemos?') + '</div>');
      chips();
      if (estado.q) T.registrar('buscar', { q: estado.q.slice(0, 60) });
    };

    T.$('#f-categorias').addEventListener('change', (e) => { estado.cat = e.target.value; estado.f = ''; aplicar(); });
    T.$('#f-min').addEventListener('input', (e) => { estado.min = e.target.value; aplicar(); });
    T.$('#f-max').addEventListener('input', (e) => { estado.max = e.target.value; aplicar(); });
    T.$('#f-nuevos').addEventListener('change', (e) => { estado.nuevos = e.target.checked; aplicar(); });
    T.$('#f-ofertas').addEventListener('change', (e) => { estado.ofertas = e.target.checked; aplicar(); });
    T.$('#f-disponibles').addEventListener('change', (e) => { estado.disponibles = e.target.checked; aplicar(); });
    T.$('#orden').addEventListener('change', (e) => { estado.orden = e.target.value; aplicar(); });
    T.$('#f-limpiar').addEventListener('click', () => { location.href = 'catalogo.html'; });
    T.$('#btn-filtros').addEventListener('click', () => T.$('#filtros').classList.toggle('abierto'));
    /* búsqueda en vivo sin recargar */
    T.$$('.buscador').forEach(f => f.addEventListener('submit', (e) => { e.preventDefault(); estado.q = f.querySelector('input').value.trim(); history.replaceState(null, '', 'catalogo.html' + (estado.q ? '?q=' + encodeURIComponent(estado.q) : '')); aplicar(); }));
    T.$$('.buscador input').forEach(i => i.addEventListener('input', () => { estado.q = i.value.trim(); aplicar(); }));
    aplicar();
  });
})();
