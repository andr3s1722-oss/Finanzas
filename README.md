# A$ · Finanzas

App estática personal, sin servidor de datos ni proceso de compilación.

## Estructura y despliegue

La versión original contenía únicamente `index.html`: estilos, pantallas, cálculos, importación/exportación y persistencia. No había dependencias ni workflows propios. GitHub Pages publica desde `main` mediante el workflow administrado `pages build and deployment`; la ejecución 33594398687 terminó correctamente el 2 de septiembre de 2026 sobre `cccf4127`.

- `index.html`: pantallas originales, formularios, almacenamiento y arranque.
- `finance.js`: cálculos puros de áreas, semanas, alertas y proyección.
- `planning.js`: interfaz semanal, áreas, alertas y plan Colombia.
- `flow.js`: pantalla Flujo (reemplaza el balance semanal): semana o mes, balance, a dónde va el dinero por categoría y comercio, de dónde entra y comparación con el periodo anterior.
- `split.js` / `splitui.js`: gastos compartidos tipo Splitwise (cálculo puro e interfaz).
- `importer.js` / `importui.js`: importar movimientos desde mensajes pegados (Nequi, Nu, bancos de EE. UU.) o CSV, con detección de duplicados, deshacer la última importación, exportación CSV y enlace `#add?...` para Atajos.
- `metas.js`: metas de ahorro (aportes y ritmo semanal necesario).
- `cloud.js` / `cloudui.js`: sincronización en la nube (Supabase). Un documento JSON por usuario con control de versión; merge de 3 vías en el cliente (lo añadido/editado/borrado en cada dispositivo se combina; si ambos tocan el mismo campo gana el dispositivo actual). Antes de aplicar cambios remotos se guarda una copia local (`finanzas_andres_v3_precloud`). Reusa la sesión por correo de Public. Requiere ejecutar `supabase/migrations/20261013000000_cloud_sync.sql` en el SQL Editor; sin la tabla la app avisa y sigue funcionando local. Los datos viven en tu proyecto de Supabase sin cifrado de extremo a extremo.
- Apple Pay → nube: `supabase/migrations/20261013010000_apple_pay_inbox.sql` crea la tabla `inbox` y tres funciones. El atajo de iOS (automatización «Transacción») hace POST a `/rest/v1/rpc/capture_expense` con una llave secreta que se genera en la app (Nube → Apple Pay); solo se guarda su hash. La app muestra los pagos como «Pagos por confirmar» (`cloudui.js`): guardar, editar o descartar; un pago ya guardado nunca se duplica y se borra de la nube. Los pagos de Apple Pay llegan en USD salvo que el atajo diga `currency=COP`.
- `faceid.js`: desbloqueo con Face ID/Touch ID por WebAuthn (autenticador de plataforma, verificación obligatoria). Es un candado local, no cifra los datos; la clave sigue de respaldo. Se activa en Ajustes por dispositivo y vuelve a pedirse tras más de un minuto fuera de la app.
- `modern.css`: diseño adaptable, temas claro/oscuro, foco y movimiento reducido.
- `tests/finance.test.cjs`: pruebas sin dependencias externas.

Los tres archivos nuevos de la app usan rutas relativas, compatibles con `/Finanzas/` en GitHub Pages. Fusionar la rama a `main` actualiza la web mediante el despliegue existente. Esta propuesta no cambia la configuración de Pages.

## Datos y compatibilidad

Se mantiene `finanzas_andres_v3` y la lectura de `finanzas_andres_v2`. Las colecciones originales, IDs, enlaces `tipId`, `spread`, monedas, categorías y campos desconocidos se conservan; siguen funcionando las migraciones previas de alimentación y activos. No hay datos personales dentro del repositorio. Los datos siguen viviendo en cada navegador y origen; una vista local no lee los datos de GitHub Pages.

Se añaden únicamente campos opcionales:

- `expenses[].area` e `income[].area`: Personal, Saava, Inversiones, Carro, Viajes, Extraordinarios.
- `settings.colombia`: `start` (AAAA-MM), `saavaRevenue`, `saavaCosts`, `livingCosts`, `otherIncome`, `movingCost` (USD) y `reserveDebt` (booleano).

Sin `area`, Saava se reconoce por `category` o `venture`; Ninas y Sequo se agrupan como Inversiones conservando la categoría. Transporte se mantiene en Personal: no se supone que todo transporte sea un costo del carro. Las clasificaciones ambiguas se pueden cambiar al editar cada registro. El filtro de movimientos abarca todas las fechas; las tarjetas del resumen muestran el mes seleccionado.

- `people[]` y `splits[]` (nuevos, opcionales): personas y gastos compartidos (`kind:'gasto'` con `payer`, `parts:[{who,share}]`, `expenseId`) o saldos (`kind:'pago'`, `from`, `to`). `who`/`payer` usan `'me'` para ti. Los saldos se llevan por moneda, relativos a ti; lo que te deben suma a Por cobrar y lo que debes a Por pagar en el patrimonio. Si marcas "Contar mi parte como gasto mío", se crea un gasto normal solo por tu parte (`expenses[].splitId`); saldar cuentas nunca es un gasto.

- `goals[]` y `history[]` (nuevos, opcionales): metas con `log` de aportes, y una foto diaria del patrimonio (`{d, nw}`) que se guarda al abrir la app; dibujar pantallas nunca modifica los datos.
- Movimientos importados llevan `importBatch` para poder deshacer el último lote.

- Guardas de moneda: al guardar, un gasto en USD de 5.000 o más (ingresos, deudas y similares, 10.000; activos, 50.000) o un monto en COP menor a 500 pide confirmación. Los formularios nuevos arrancan en la última moneda usada con éxito (preferencia local `finanzas_ultima_moneda`, fuera del respaldo). En gastos nuevos (y en Split), si la moneda sigue en USD pero el monto parece pesos —comercio colombiano con 1.000 o más (Oxxo, Rappi, D1…), Restaurante/Mercado/Salud con 1.500 o más, formato `45.900`, o 10.000 o más fuera de Vivienda— el selector cambia solo a COP y lo avisa; si eliges la moneda a mano, o editas un registro, no se toca. El enlace `#add` de Atajos no adivina: es USD salvo `moneda=COP`. La tasa del dólar solo admite 2.000–6.000 COP, igual que la TRM oficial; si un respaldo trae una tasa fuera de rango se repara con la última TRM válida del historial (o 4.100).

## Criterios de cálculo

- Semanas completas de lunes a domingo, incluso al cruzar meses/años. Ingresos = `income` + horas × tarifa actual. El salario se atribuye a Personal y se incluye en balances y alertas. Se calcula al mostrar la app sin añadir registros al JSON. No registrar de nuevo el pago de esas horas, pues se sumaría dos veces. Cambiar la tarifa recalcula estimaciones históricas, como en la versión original. Las propinas ligadas se cuentan una sola vez.
- Balance semanal = ingresos registrados + salario por horas − gastos pagados. Incluye todas las áreas al seleccionar Todos. El presupuesto semanal Personal respeta `spread`, sin confundir el reparto presupuestario con el pago real.
- Alertas dentro de la app: 80% del presupuesto personal, exceso del presupuesto, 80% de cupo de tarjeta, deudas vencidas o dentro de 7 días, flujo mensual negativo y déficit del escenario Colombia. Son umbrales de interfaz, no asesoría ni notificaciones externas. Los avisos de deuda leen `dueDate` o `vence` en formato AAAA-MM-DD; texto libre se conserva sin interpretar.
- Colombia: ventas Saava − costos Saava + otros ingresos − gastos de vida; propinas y salario del café son cero. Efectivo inicial = activos tipo Liquidez − mudanza − deudas actuales si se activa la reserva. Proyección constante de 12 meses, sin rendimientos, crecimiento o ingresos previos al regreso supuestos. Incluir impuestos y cuotas futuras dentro de los costos.
- Jetta: referencia USD 6,000; si falta hay un botón explícito para registrarlo como Vehículo. Un Jetta existente conserva su valoración y no se duplica. No se suma como efectivo ni se presupone una venta.

## Verificación

```sh
node --test tests/*.test.cjs
python3 -m http.server 8765 --bind 127.0.0.1
```

Las pruebas usan ejemplos sintéticos, no un respaldo real del usuario. Antes de publicar, exportar el respaldo desde la web actual permite conservar una copia externa. La contraseña de entrada continúa siendo un bloqueo cosmético, como ya advierte Ajustes; no hay autenticación de servidor.
